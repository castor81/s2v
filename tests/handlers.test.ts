// Végpont-tesztek hamis (memóriabeli) adatbázissal: a valódi kezelők futnak, csak a Supabase-kliens cserélt.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { __setDbForTests } from '../api/_lib/http.js';
import { generateToken, hashDevice, sha256Hex } from '../api/_lib/crypto.js';
import create from '../api/create.js';
import live from '../api/live.js';
import results from '../api/results.js';
import status from '../api/status.js';
import update from '../api/update.js';

process.env.DEVICE_SALT = 'test-salt';
process.env.BASE_URL = 'https://example.test';
process.env.CREATE_GATE_CODE = 'gate-secret';

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

class Q implements PromiseLike<any> {
  private filters: Array<[string, unknown]> = [];
  private op: 'select' | 'update' | 'insert' = 'select';
  private patch: Row = {};
  private count = false;
  private head = false;
  constructor(private tables: Tables, private table: string) {}
  select(_cols?: string, o?: { count?: string; head?: boolean }) {
    this.count = Boolean(o?.count);
    this.head = Boolean(o?.head);
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  range() {
    return this;
  }
  update(p: Row) {
    this.op = 'update';
    this.patch = p;
    return this;
  }
  insert(r: Row) {
    this.op = 'insert';
    this.patch = r;
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run(true));
  }
  then(a?: any, b?: any): any {
    return Promise.resolve(this.run(false)).then(a, b);
  }
  private run(single: boolean) {
    const rows = (this.tables[this.table] ??= []);
    if (this.op === 'insert') {
      rows.push({ id: `${this.table}-${rows.length + 1}`, ...this.patch });
      return { data: null, error: null };
    }
    const match = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
    if (this.op === 'update') match.forEach((r) => Object.assign(r, this.patch));
    if (this.count && this.head) return { data: null, error: null, count: match.length };
    return { data: single ? (match[0] ?? null) : match, error: null };
  }
}

let tables: Tables;
beforeEach(() => {
  tables = { polls: [], votes: [], poll_sessions: [] };
  __setDbForTests({ from: (t: string) => new Q(tables, t) });
});

async function call(handler: (req: any, res: any) => unknown, body: unknown) {
  const res: any = {
    code: 0,
    body: undefined,
    status(c: number) {
      this.code = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
    setHeader() {},
  };
  await handler({ method: 'POST', body, headers: {}, socket: { remoteAddress: '10.0.0.1' } }, res);
  return res as { code: number; body: any };
}

const OPTS = [
  { id: 'o1', hu: 'A' },
  { id: 'o2', hu: 'B' },
  { id: 'o3', hu: 'C' },
];
const DAY = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const DEVICE = 'device-aaaaaaaaaaaaaaaaaaaa';

function addPoll(extra: Row = {}) {
  const token = generateToken();
  const poll: Row = {
    id: `p${tables.polls.length + 1}`,
    slug: `s${String(tables.polls.length + 1).padStart(5, '0')}`.slice(0, 6).replace(/s0*/, 'k').padEnd(6, 'x'),
    title: { hu: 'Cím' },
    options: OPTS,
    status: 'open',
    opens_at: null,
    closes_at: null,
    closed_at: null,
    created_at: new Date().toISOString(),
    organizer_token_hash: sha256Hex(token),
    ...extra,
  };
  tables.polls.push(poll);
  return { token, poll };
}

function addVote(pollId: string, optionId: string, device = DEVICE) {
  tables.votes.push({ id: `v${tables.votes.length + 1}`, poll_id: pollId, option_id: optionId, device_hash: hashDevice(device, 'test-salt') });
}

// ---------------- live ----------------

test('live: érvénytelen kérés 400, ismeretlen szavazás 404', async () => {
  assert.equal((await call(live, { slug: 'x', deviceId: DEVICE })).code, 400);
  assert.equal((await call(live, { slug: 'zzzzzz', deviceId: DEVICE })).code, 404);
});

test('live: szavazat előtt 403, szavazat után 200 a számokkal, szervezői mérőszám nélkül', async () => {
  const { poll } = addPoll({ slug: 'livea1' });
  assert.equal((await call(live, { slug: poll.slug, deviceId: DEVICE })).code, 403);

  addVote(poll.id, 'o2');
  addVote(poll.id, 'o2', 'device-bbbbbbbbbbbbbbbbbbbb');
  addVote(poll.id, 'o3', 'device-cccccccccccccccccccc');
  // a gyorsítótár miatt új szavazásnál ellenőrzünk: más slug
  const { poll: p2 } = addPoll({ slug: 'liveb2' });
  addVote(p2.id, 'o2');
  addVote(p2.id, 'o2', 'device-bbbbbbbbbbbbbbbbbbbb');
  addVote(p2.id, 'o3', 'device-cccccccccccccccccccc');
  const r = await call(live, { slug: p2.slug, deviceId: DEVICE });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.counts, { o1: 0, o2: 2, o3: 1 });
  assert.equal(r.body.votes, 3);
  assert.equal(r.body.sessions, undefined);
  assert.equal(r.body.completionRate, undefined);
  // más eszköz, amely nem szavazott: továbbra is 403
  assert.equal((await call(live, { slug: p2.slug, deviceId: 'device-zzzzzzzzzzzzzzzzzzzz' })).code, 403);
});

// ---------------- create ----------------

test('create: rossz belépési kód 401; időzítéssel 201, az időpontok tárolódnak', async () => {
  const body = { title: { hu: 'T' }, options: [{ hu: 'a' }, { hu: 'b' }] };
  assert.equal((await call(create, { ...body, gateCode: 'rossz' })).code, 401);

  const opens = inDays(21);
  const closes = new Date(Date.parse(opens) + 3_600_000).toISOString();
  const r = await call(create, { ...body, gateCode: 'gate-secret', opensAt: opens, closesAt: closes });
  assert.equal(r.code, 201);
  assert.equal(tables.polls[0].opens_at, opens);
  assert.equal(tables.polls[0].closes_at, closes);
  assert.match(r.body.organizerUrl, /^https:\/\/example\.test\/o\/[A-Za-z0-9_-]{43}$/);

  const bad = await call(create, { ...body, gateCode: 'gate-secret', closesAt: inDays(-1) });
  assert.equal(bad.code, 400);
  assert.equal(bad.body.error, 'closes_in_past');
});

// ---------------- results / status ----------------

test('results: érvénytelen token 400, ismeretlen 404, érvényesre számok és időzítés', async () => {
  assert.equal((await call(results, { token: 'rövid' })).code, 400);
  assert.equal((await call(results, { token: generateToken() })).code, 404);

  const { token, poll } = addPoll({ closes_at: inDays(2) });
  addVote(poll.id, 'o1');
  tables.poll_sessions.push({ poll_id: poll.id, device_hash: 'h1', first_seen_at: '2026-11-03T10:00:00Z', voted_at: '2026-11-03T10:00:10Z' });
  const r = await call(results, { token });
  assert.equal(r.code, 200);
  assert.equal(r.body.stats.votes, 1);
  assert.equal(r.body.stats.completionRate, 1);
  assert.equal(r.body.closesAt, poll.closes_at);
  assert.equal(r.body.status, 'open');
});

test('status: lezárás rögzíti a closed_at-ot; újranyitás törli az időablakot', async () => {
  const { token, poll } = addPoll({ closes_at: inDays(2) });
  const closed = await call(status, { token, action: 'close' });
  assert.equal(closed.code, 200);
  assert.equal(closed.body.status, 'closed');
  assert.ok(poll.closed_at);

  const reopened = await call(status, { token, action: 'open' });
  assert.equal(reopened.body.status, 'open');
  assert.equal(poll.closed_at, null);
  assert.equal(poll.closes_at, null);
});

// ---------------- update ----------------

test('update: nyitás előtt módosítható a tartalom és az időzítés, az azonosítók újraképződnek', async () => {
  const { token, poll } = addPoll({ opens_at: inDays(10), closes_at: inDays(11) });
  const r = await call(update, {
    token,
    title: { hu: 'Új cím', en: 'New title' },
    options: [{ hu: 'X' }, { hu: 'Y' }],
    opensAt: inDays(20),
    closesAt: inDays(21),
  });
  assert.equal(r.code, 200);
  assert.equal(r.body.status, 'upcoming');
  assert.deepEqual(poll.title, { hu: 'Új cím', en: 'New title' });
  assert.deepEqual(poll.options.map((o: any) => o.id), ['o1', 'o2']);
  assert.ok(Date.parse(poll.opens_at) > Date.now() + 19 * DAY);
  assert.ok(Date.parse(poll.closes_at) > Date.parse(poll.opens_at));
});

test('update: hiányos tartalom, üres kérés, rossz időzítés', async () => {
  const { token } = addPoll({ opens_at: inDays(10) });
  assert.equal((await call(update, { token })).body.error, 'nothing_to_update');
  assert.equal((await call(update, { token, title: { hu: 'x' } })).body.error, 'content_incomplete');
  const bad = await call(update, { token, opensAt: inDays(10), closesAt: inDays(9) });
  assert.equal(bad.code, 400);
  assert.equal(bad.body.error, 'window_too_short');
});

test('update: nyitott szavazásnál csak a zárás módosítható', async () => {
  const { token, poll } = addPoll({ opens_at: null });
  const content = await call(update, { token, title: { hu: 'x' }, options: [{ hu: 'a' }, { hu: 'b' }] });
  assert.equal(content.code, 409);
  assert.equal(content.body.error, 'already_open');
  assert.equal((await call(update, { token, opensAt: inDays(5) })).code, 409);

  const ok = await call(update, { token, closesAt: inDays(3) });
  assert.equal(ok.code, 200);
  assert.ok(poll.closes_at);
  assert.equal((await call(update, { token, closesAt: inDays(-1) })).body.error, 'closes_in_past');

  const clear = await call(update, { token, closesAt: null });
  assert.equal(clear.code, 200);
  assert.equal(poll.closes_at, null);
});

test('update: lezárt szavazás, szavazattal rendelkező és ismeretlen token elutasítva', async () => {
  const closed = addPoll({ status: 'closed', closed_at: new Date().toISOString() });
  assert.equal((await call(update, { token: closed.token, closesAt: inDays(2) })).body.error, 'closed');

  const voted = addPoll({ opens_at: inDays(5) });
  addVote(voted.poll.id, 'o1');
  const r = await call(update, { token: voted.token, title: { hu: 'x' }, options: [{ hu: 'a' }, { hu: 'b' }] });
  assert.equal(r.body.error, 'already_open');

  assert.equal((await call(update, { token: generateToken(), closesAt: inDays(2) })).code, 404);
});
