// A master végpont és a kódtár tesztjei hamis adatbázissal.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { __setDbForTests } from '../api/_lib/http.js';
import { generateToken, hashDevice, sha256Hex, generateAccessCode } from '../api/_lib/crypto.js';
import { hashAccessCode, validateAccessCode } from '../api/_lib/codes.js';
import create from '../api/create.js';
import master from '../api/master.js';
import results from '../api/results.js';
import { call, makeFakeDb, type Row, type Tables } from './fakedb.js';

process.env.DEVICE_SALT = 'test-salt';
process.env.BASE_URL = 'https://example.test';
process.env.CREATE_GATE_CODE = 'gate-secret';
process.env.MASTER_CODE = 'master-secret-code-123';

const MC = 'master-secret-code-123';
const DAY = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const OPTS = [
  { id: 'o1', hu: 'A' },
  { id: 'o2', hu: 'B' },
];

let tables: Tables;
let ipCounter = 0;
beforeEach(() => {
  tables = { polls: [], votes: [], poll_sessions: [], s2v_projects: [], s2v_access_codes: [] };
  __setDbForTests(makeFakeDb(tables));
});

// Minden hívás saját IP-ről megy, hogy a sikertelen próbák zárolása ne hasson a többi tesztre.
const m = (action: string, extra: Row = {}, code = MC) => call(master, { masterCode: code, action, ...extra }, `10.1.0.${++ipCounter}`);

function addPoll(extra: Row = {}) {
  const token = generateToken();
  const n = tables.polls.length + 1;
  const poll: Row = {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    slug: `p${String(n).padStart(5, '0')}`,
    title: { hu: 'Cím' },
    options: OPTS,
    status: 'open',
    opens_at: null,
    closes_at: null,
    closed_at: null,
    created_at: new Date(Date.now() - n * 1000).toISOString(),
    archived_at: null,
    project_id: null,
    code_id: null,
    organizer_token_hash: sha256Hex(token),
    ...extra,
  };
  tables.polls.push(poll);
  return { token, poll };
}
const addVote = (pollId: string, optionId: string, device: string) =>
  tables.votes.push({ id: `v${tables.votes.length + 1}`, poll_id: pollId, option_id: optionId, device_hash: hashDevice(device, 'test-salt') });

// ---------------- hitelesítés ----------------

test('master: hibás kód 401, hiányzó kód 401, jó kód belép; ismeretlen művelet 400', async () => {
  assert.equal((await m('overview', {}, 'rossz')).code, 401);
  assert.equal((await call(master, { action: 'overview' }, '10.9.9.9')).code, 401);
  assert.equal((await m('login')).code, 200);
  assert.equal((await m('nincs-ilyen')).code, 400);
});

test('master: ha nincs beállítva MASTER_CODE, 503', async () => {
  const saved = process.env.MASTER_CODE;
  delete process.env.MASTER_CODE;
  assert.equal((await m('login')).code, 503);
  process.env.MASTER_CODE = saved;
});

test('master: 10 sikertelen próba után az IP zárolva, még a helyes kód is 429', async () => {
  const ip = '10.77.0.1';
  for (let i = 0; i < 10; i++) assert.equal((await call(master, { masterCode: 'x', action: 'login' }, ip)).code, 401);
  assert.equal((await call(master, { masterCode: MC, action: 'login' }, ip)).code, 429);
  // más IP-t nem érint
  assert.equal((await m('login')).code, 200);
});

// ---------------- áttekintés ----------------

test('overview: állapotok, szavazatszámok, törlési határidő, kódok tokenek nélkül', async () => {
  const run = addPoll();
  const up = addPoll({ opens_at: inDays(7) });
  const closedAt = new Date(Date.now() - 5 * DAY).toISOString();
  const done = addPoll({ status: 'closed', closed_at: closedAt });
  addVote(run.poll.id, 'o2', 'device-aaaaaaaaaaaaaaaaaaaa');
  addVote(run.poll.id, 'o2', 'device-bbbbbbbbbbbbbbbbbbbb');
  addVote(run.poll.id, 'o1', 'device-cccccccccccccccccccc');
  tables.poll_sessions.push({ poll_id: run.poll.id, device_hash: 'h1' }, { poll_id: run.poll.id, device_hash: 'h2' });

  const r = await m('overview');
  assert.equal(r.code, 200);
  const byId = Object.fromEntries(r.body.polls.map((p: any) => [p.id, p]));
  assert.equal(byId[run.poll.id].status, 'open');
  assert.deepEqual(byId[run.poll.id].stats, { votes: 3, sessions: 2, counts: { o1: 1, o2: 2 } });
  assert.equal(byId[up.poll.id].status, 'upcoming');
  assert.equal(byId[done.poll.id].status, 'closed');
  assert.equal(Date.parse(byId[done.poll.id].purgeAt), Date.parse(closedAt) + 30 * DAY);
  assert.equal(byId[run.poll.id].purgeAt, null);
  assert.equal(byId[run.poll.id].voteUrl, `https://example.test/${run.poll.slug}`);
  assert.ok(!JSON.stringify(r.body).includes('organizer_token_hash'));
  assert.ok(!JSON.stringify(r.body).includes('code_hash'));
});

// ---------------- szerkesztés / állapot / törlés ----------------

test('poll.update: nyitás előtt szerkeszthető; futó és lezárt nem; szavazattal sem', async () => {
  const up = addPoll({ opens_at: inDays(5), closes_at: inDays(6) });
  const r = await m('poll.update', {
    id: up.poll.id,
    title: { hu: 'Új' },
    options: [{ hu: 'X' }, { hu: 'Y' }, { hu: 'Z' }],
    opensAt: inDays(10),
    closesAt: inDays(11),
  });
  assert.equal(r.code, 200);
  assert.deepEqual(up.poll.title, { hu: 'Új' });
  assert.equal(up.poll.options.length, 3);

  const run = addPoll();
  const run1 = await m('poll.update', { id: run.poll.id, closesAt: inDays(2) });
  assert.equal(run1.code, 409);
  assert.equal(run1.body.error, 'already_open');
  assert.equal((await m('poll.update', { id: run.poll.id, title: { hu: 'x' }, options: OPTS })).body.error, 'already_open');

  const cl = addPoll({ status: 'closed', closed_at: new Date().toISOString() });
  assert.equal((await m('poll.update', { id: cl.poll.id, closesAt: inDays(2) })).body.error, 'closed');

  const voted = addPoll({ opens_at: inDays(5) });
  addVote(voted.poll.id, 'o1', 'device-aaaaaaaaaaaaaaaaaaaa');
  assert.equal((await m('poll.update', { id: voted.poll.id, opensAt: inDays(6) })).body.error, 'already_open');

  assert.equal((await m('poll.update', { id: 'nem-uuid' })).code, 400);
  assert.equal((await m('poll.update', { id: '00000000-0000-4000-8000-999999999999', opensAt: inDays(6) })).code, 404);
});

test('poll.status: lezárás és újranyitás', async () => {
  const { poll } = addPoll({ closes_at: inDays(2) });
  assert.equal((await m('poll.status', { id: poll.id, to: 'close' })).code, 200);
  assert.equal(poll.status, 'closed');
  assert.ok(poll.closed_at);
  assert.equal((await m('poll.status', { id: poll.id, to: 'open' })).code, 200);
  assert.equal(poll.closed_at, null);
  assert.equal(poll.closes_at, null);
  assert.equal((await m('poll.status', { id: poll.id, to: 'x' })).code, 400);
});

test('poll.delete: futó szavazás nem törölhető; a többi igen, szavazatokkal együtt', async () => {
  const run = addPoll();
  assert.equal((await m('poll.delete', { id: run.poll.id })).body.error, 'running');
  assert.equal(tables.polls.length, 1);

  const up = addPoll({ opens_at: inDays(3) });
  const cl = addPoll({ status: 'closed', closed_at: new Date().toISOString() });
  addVote(cl.poll.id, 'o1', 'device-aaaaaaaaaaaaaaaaaaaa');
  assert.equal((await m('poll.delete', { id: up.poll.id })).code, 200);
  assert.equal((await m('poll.delete', { id: cl.poll.id })).code, 200);
  assert.deepEqual(tables.polls.map((p) => p.id), [run.poll.id]);
  assert.equal(tables.votes.length, 0);
});

test('poll.meta: projekthez rendelés és archiválás', async () => {
  const { poll } = addPoll();
  const proj = await m('project.create', { name: 'Tanévnyitó' });
  assert.equal(proj.code, 201);
  assert.equal((await m('poll.meta', { id: poll.id, projectId: proj.body.id })).code, 200);
  assert.equal(poll.project_id, proj.body.id);
  assert.equal((await m('poll.meta', { id: poll.id, projectId: '00000000-0000-4000-8000-00000000ffff' })).body.error, 'project_not_found');
  assert.equal((await m('poll.meta', { id: poll.id, archived: true })).code, 200);
  assert.ok(poll.archived_at);
  assert.equal((await m('poll.meta', { id: poll.id, archived: false, projectId: null })).code, 200);
  assert.equal(poll.archived_at, null);
  assert.equal(poll.project_id, null);
  assert.equal((await m('poll.meta', { id: poll.id })).body.error, 'nothing_to_update');
});

test('poll.copy: új szavazás ugyanazzal a tartalommal, új szervezői linkkel és a projekttel', async () => {
  const proj = await m('project.create', { name: 'P' });
  const src = addPoll({ title: { hu: 'Forrás', en: 'Source' }, status: 'closed', closed_at: new Date().toISOString(), project_id: proj.body.id });
  const opens = inDays(14);
  const r = await m('poll.copy', { id: src.poll.id, opensAt: opens, closesAt: new Date(Date.parse(opens) + 3_600_000).toISOString() });
  assert.equal(r.code, 201);
  assert.match(r.body.organizerUrl, /^https:\/\/example\.test\/o\/[A-Za-z0-9_-]{43}$/);
  const copy = tables.polls[1];
  assert.deepEqual(copy.title, src.poll.title);
  assert.deepEqual(copy.options, src.poll.options);
  assert.equal(copy.opens_at, opens);
  assert.equal(copy.project_id, proj.body.id);
  assert.equal(copy.closed_at ?? null, null);
  assert.equal((await m('poll.copy', { id: src.poll.id, closesAt: inDays(-1) })).body.error, 'closes_in_past');
});

test('poll.newToken: az új link működik, a régi megszűnik', async () => {
  const { token, poll } = addPoll();
  assert.equal((await call(results, { token }, '10.2.0.1')).code, 200);
  const r = await m('poll.newToken', { id: poll.id });
  assert.equal(r.code, 200);
  const fresh = r.body.organizerUrl.split('/o/')[1];
  assert.equal((await call(results, { token: fresh }, '10.2.0.2')).code, 200);
  assert.equal((await call(results, { token }, '10.2.0.3')).code, 404);
});

// ---------------- projektek ----------------

test('project: létrehozás, névütközés (kis-nagybetű nélkül), átnevezés, törlés eltávolítja a kötéseket', async () => {
  const a = await m('project.create', { name: 'Alfa' });
  assert.equal(a.code, 201);
  assert.equal((await m('project.create', { name: 'alfa' })).body.error, 'name_taken');
  assert.equal((await m('project.create', { name: '   ' })).body.error, 'name_invalid');
  const b = await m('project.create', { name: 'Béta' });
  assert.equal((await m('project.rename', { id: b.body.id, name: 'Alfa' })).body.error, 'name_taken');
  assert.equal((await m('project.rename', { id: b.body.id, name: 'Gamma' })).code, 200);

  const { poll } = addPoll({ project_id: a.body.id });
  const code = await m('code.create', { label: 'K', projectId: a.body.id });
  assert.equal((await m('project.delete', { id: a.body.id })).code, 200);
  assert.equal(poll.project_id, null);
  assert.equal(tables.s2v_access_codes[0].project_id, null);
  assert.equal(code.code, 201);
  assert.equal(tables.s2v_projects.length, 1);
});

// ---------------- kódtár és létrehozás ----------------

test('code.create: generált kód 3×4 formátumú, csak a lenyomata tárolódik', async () => {
  const r = await m('code.create', { label: 'Hallgatói önkormányzat' });
  assert.equal(r.code, 201);
  assert.match(r.body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const row = tables.s2v_access_codes[0];
  assert.equal(row.code_hash, hashAccessCode(r.body.code));
  assert.ok(!JSON.stringify(row).includes(r.body.code));
});

test('code.create: egyedi kód szabályai (hossz, szóköz, ütközés, általános kóddal azonos, lejárat)', async () => {
  assert.equal((await m('code.create', { label: 'x', code: 'rövid' })).body.error, 'code_too_short');
  assert.equal((await m('code.create', { label: 'x', code: 'van benne szóköz' })).body.error, 'code_invalid');
  assert.equal((await m('code.create', { label: '', code: 'hosszu-kod-123' })).body.error, 'label_invalid');
  assert.equal((await m('code.create', { label: 'x', code: 'gate-secret' })).body.error, 'code_taken');
  assert.equal((await m('code.create', { label: 'x', code: 'hosszu-kod-123', expiresAt: inDays(-1) })).body.error, 'expiry_past');
  assert.equal((await m('code.create', { label: 'x', code: 'hosszu-kod-123', expiresAt: 'nem-datum' })).body.error, 'expiry_invalid');
  assert.equal((await m('code.create', { label: 'x', code: 'hosszu-kod-123' })).code, 201);
  assert.equal((await m('code.create', { label: 'y', code: 'hosszu-kod-123' })).body.error, 'code_taken');
});

test('create: a kódtár kódja működik, projekthez kötött kód a projektbe teszi a szavazást, számlál', async () => {
  const proj = await m('project.create', { name: 'Konferencia' });
  const generic = await m('code.create', { label: 'Általános', code: 'altalanos-kod-1' });
  await m('code.create', { label: 'Konferencia', code: 'konferencia-kod-1', projectId: proj.body.id });
  const body = { title: { hu: 'T' }, options: [{ hu: 'a' }, { hu: 'b' }] };
  const ip = '10.3.0.1';

  assert.equal((await call(create, { ...body, gateCode: 'altalanos-kod-1' }, ip)).code, 201);
  assert.equal(tables.polls[0].project_id, null);
  assert.equal(tables.polls[0].code_id, generic.body.id);

  assert.equal((await call(create, { ...body, gateCode: 'konferencia-kod-1' }, ip)).code, 201);
  assert.equal(tables.polls[1].project_id, proj.body.id);
  assert.equal(tables.s2v_access_codes[1].use_count, 1);
  assert.ok(tables.s2v_access_codes[1].last_used_at);

  // az általános (környezeti) kód továbbra is működik, projekt nélkül
  assert.equal((await call(create, { ...body, gateCode: 'gate-secret' }, ip)).code, 201);
  assert.equal(tables.polls[2].project_id, null);
  assert.equal(tables.polls[2].code_id, null);
  assert.equal((await call(create, { ...body, gateCode: 'ismeretlen-kod' }, ip)).code, 401);
});

test('create: kikapcsolt és lejárt kód elutasítva; a lejárat beállítása azonnal hat', async () => {
  const c = await m('code.create', { label: 'K', code: 'ideiglenes-kod-1' });
  const body = { gateCode: 'ideiglenes-kod-1', title: { hu: 'T' }, options: [{ hu: 'a' }, { hu: 'b' }] };
  const ip = '10.3.0.2';
  assert.equal((await call(create, body, ip)).code, 201);

  assert.equal((await m('code.update', { id: c.body.id, active: false })).code, 200);
  assert.equal((await call(create, body, ip)).code, 401);
  assert.equal((await m('code.update', { id: c.body.id, active: true })).code, 200);
  assert.equal((await call(create, body, ip)).code, 201);

  assert.equal((await m('code.update', { id: c.body.id, expiresAt: inDays(-1) })).code, 200);
  assert.equal((await call(create, body, ip)).code, 401);
});

test('code.delete: a kód megszűnik, a vele létrehozott szavazás megmarad', async () => {
  const c = await m('code.create', { label: 'K', code: 'torlendo-kod-1' });
  const { poll } = addPoll({ code_id: c.body.id });
  assert.equal((await m('code.delete', { id: c.body.id })).code, 200);
  assert.equal(tables.s2v_access_codes.length, 0);
  assert.equal(poll.code_id, null);
  const r = await call(create, { gateCode: 'torlendo-kod-1', title: { hu: 'T' }, options: [{ hu: 'a' }, { hu: 'b' }] }, '10.3.0.3');
  assert.equal(r.code, 401);
});

test('segédek: kódgenerátor és kódellenőrzés', () => {
  assert.match(generateAccessCode(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.notEqual(generateAccessCode(), generateAccessCode());
  assert.equal(validateAccessCode('  hosszu-kod-1  ').ok, true);
  assert.notEqual(hashAccessCode('a'), hashAccessCode('b'));
});
