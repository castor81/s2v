import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, limitReached, rateLimited, send } from './_lib/http.js';
import { generateAccessCode, generateToken, safeEqual, sha256Hex } from './_lib/crypto.js';
import { hashAccessCode, validateAccessCode } from './_lib/codes.js';
import { insertPoll } from './_lib/pollCreate.js';
import { planEdit } from './_lib/pollEdit.js';
import { effectiveStatus, validateSchedule, type PollOption } from './_lib/validate.js';

// POST /api/master  { masterCode, action, ...adatok }
// A master felület egyetlen végpontja (egy szerver nélküli függvény). Minden kérés a master kóddal
// hitelesít; a kód a MASTER_CODE környezeti változóban van, a kliens csak a böngésző munkamenetében őrzi.
//
// Műveletek: overview · poll.update · poll.meta · poll.status · poll.delete · poll.copy · poll.newToken ·
//            project.create · project.rename · project.delete · code.create · code.update · code.delete

const RETENTION_DAYS = 30; // a lezárt szavazások megőrzése (A1), megegyezik a purge_closed_polls alapértékével
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 80;
const POLL_COLS =
  'id, slug, title, options, status, opens_at, closes_at, closed_at, created_at, archived_at, project_id, code_id';

type Body = Record<string, unknown>;
type Reply = { status: number; body: unknown };
const ok = (body: unknown = { ok: true }, status = 200): Reply => ({ status, body });
const fail = (status: number, error: string): Reply => ({ status, body: { error } });
const serverError = (): Reply => fail(500, 'server_error');

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= NAME_MAX ? t : null;
}

/** Egyetlen szavazás lekérése azonosító alapján. */
async function loadPoll(id: unknown) {
  if (!isUuid(id)) return { reply: fail(400, 'invalid_request'), poll: undefined } as const;
  const { data, error } = await db().from('polls').select(POLL_COLS).eq('id', id).maybeSingle();
  if (error) {
    console.error('master: poll lookup failed', error.code, error.message);
    return { reply: serverError(), poll: undefined } as const;
  }
  if (!data) return { reply: fail(404, 'not_found'), poll: undefined } as const;
  return { reply: undefined, poll: data } as const;
}

/** Létező projekt ellenőrzése; null azonosító = nincs projekt. */
async function checkProject(id: unknown): Promise<Reply | null> {
  if (id === null) return null;
  if (!isUuid(id)) return fail(400, 'invalid_request');
  const { data, error } = await db().from('s2v_projects').select('id').eq('id', id).maybeSingle();
  if (error) return serverError();
  return data ? null : fail(404, 'project_not_found');
}

function parseInstantOrNull(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === undefined || v === null || v === '') return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false };
  const t = Date.parse(v);
  return Number.isFinite(t) ? { ok: true, value: new Date(t).toISOString() } : { ok: false };
}

// ---------------- áttekintés ----------------

async function overview(): Promise<Reply> {
  const [polls, projects, codes, counts] = await Promise.all([
    db().from('polls').select(POLL_COLS).order('created_at', { ascending: false }).range(0, 999),
    db().from('s2v_projects').select('id, name, created_at').order('name', { ascending: true }).range(0, 499),
    db()
      .from('s2v_access_codes')
      .select('id, label, project_id, active, expires_at, use_count, last_used_at, created_at')
      .order('created_at', { ascending: false })
      .range(0, 499),
    db().rpc('master_poll_counts'),
  ]);
  const err = polls.error ?? projects.error ?? codes.error ?? counts.error;
  if (err) {
    console.error('master: overview failed', err.code, err.message);
    return serverError();
  }

  const base = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
  const byPoll = new Map<string, { votes: number; sessions: number; counts: Record<string, number> }>();
  for (const c of (counts.data ?? []) as Array<{ poll_id: string; votes: number; sessions: number; counts: Record<string, number> }>) {
    byPoll.set(c.poll_id, { votes: Number(c.votes), sessions: Number(c.sessions), counts: c.counts ?? {} });
  }
  const now = new Date();

  const pollViews = (polls.data ?? []).map((p) => {
    const status = effectiveStatus(p, now);
    const s = byPoll.get(p.id) ?? { votes: 0, sessions: 0, counts: {} };
    const options = p.options as PollOption[];
    const countMap: Record<string, number> = {};
    for (const o of options) countMap[o.id] = Number(s.counts[o.id] ?? 0);

    // Törlés időpontja: a lezárástól (kézi vagy az időablak vége) számított megőrzési idő vége.
    const closedBase = p.closed_at ?? (status === 'closed' ? p.closes_at : null);
    const purgeAt = closedBase ? new Date(Date.parse(closedBase) + RETENTION_DAYS * 86_400_000).toISOString() : null;

    return {
      id: p.id,
      slug: p.slug,
      voteUrl: `${base}/${p.slug}`,
      title: p.title,
      options,
      status,
      opensAt: p.opens_at,
      closesAt: p.closes_at,
      closedAt: p.closed_at,
      createdAt: p.created_at,
      archivedAt: p.archived_at,
      projectId: p.project_id,
      codeId: p.code_id,
      purgeAt,
      stats: { votes: s.votes, sessions: s.sessions, counts: countMap },
    };
  });

  return ok({
    now: now.toISOString(),
    retentionDays: RETENTION_DAYS,
    polls: pollViews,
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    codes: (codes.data ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      projectId: c.project_id,
      active: c.active,
      expiresAt: c.expires_at,
      useCount: c.use_count,
      lastUsedAt: c.last_used_at,
      createdAt: c.created_at,
    })),
    generalCodeActive: Boolean(process.env.CREATE_GATE_CODE),
  });
}

// ---------------- szavazások ----------------

async function pollUpdate(body: Body): Promise<Reply> {
  const l = await loadPoll(body.id);
  if (l.reply) return l.reply;
  // Futó szavazás a masteren nem módosítható (csak lezárható); a nyitás előtti szavazás teljesen szerkeszthető.
  const plan = await planEdit(l.poll, body, { allowCloseWhenOpen: false });
  if (!plan.ok) return fail(plan.status, plan.error);
  const { error } = await db().from('polls').update(plan.patch).eq('id', l.poll.id);
  if (error) {
    console.error('master: poll update failed', error.code, error.message);
    return serverError();
  }
  return ok();
}

async function pollMeta(body: Body): Promise<Reply> {
  const l = await loadPoll(body.id);
  if (l.reply) return l.reply;
  const patch: Record<string, unknown> = {};
  if ('projectId' in body) {
    const pe = await checkProject(body.projectId);
    if (pe) return pe;
    patch.project_id = body.projectId;
  }
  if ('archived' in body) {
    if (typeof body.archived !== 'boolean') return fail(400, 'invalid_request');
    patch.archived_at = body.archived ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return fail(400, 'nothing_to_update');
  const { error } = await db().from('polls').update(patch).eq('id', l.poll.id);
  if (error) {
    console.error('master: poll meta failed', error.code, error.message);
    return serverError();
  }
  return ok();
}

async function pollStatus(body: Body): Promise<Reply> {
  // A művelet neve a `to` mezőben érkezik ('open' | 'close'), mert az `action` a végpont műveletét jelöli.
  if (body.to !== 'open' && body.to !== 'close') return fail(400, 'invalid_request');
  const l = await loadPoll(body.id);
  if (l.reply) return l.reply;
  // Azonos a szervezői végponttal: a lezárás rögzíti a closed_at-ot, az újranyitás törli az időablakot.
  const patch =
    body.to === 'close'
      ? { status: 'closed', closed_at: new Date().toISOString() }
      : { status: 'open', closed_at: null, opens_at: null, closes_at: null };
  const { error } = await db().from('polls').update(patch).eq('id', l.poll.id);
  if (error) {
    console.error('master: poll status failed', error.code, error.message);
    return serverError();
  }
  return ok();
}

async function pollDelete(body: Body): Promise<Reply> {
  const l = await loadPoll(body.id);
  if (l.reply) return l.reply;
  if (effectiveStatus(l.poll) === 'open') return fail(409, 'running'); // futó szavazás nem törölhető
  const { error } = await db().from('polls').delete().eq('id', l.poll.id); // a szavazatok és munkamenetek kaszkádolva törlődnek
  if (error) {
    console.error('master: poll delete failed', error.code, error.message);
    return serverError();
  }
  return ok();
}

async function pollCopy(body: Body): Promise<Reply> {
  const l = await loadPoll(body.id);
  if (l.reply) return l.reply;
  const s = validateSchedule({ opensAt: body.opensAt, closesAt: body.closesAt });
  if (!s.ok) return fail(400, s.error);
  const created = await insertPoll({
    title: l.poll.title,
    options: l.poll.options as PollOption[],
    opensAt: s.value.opensAt,
    closesAt: s.value.closesAt,
    projectId: l.poll.project_id ?? null,
    codeId: null,
  });
  if (!created.ok) return fail(500, created.error);
  return ok({ slug: created.slug, voteUrl: created.voteUrl, organizerUrl: created.organizerUrl }, 201);
}

async function pollNewToken(body: Body): Promise<Reply> {
  const l = await loadPoll(body.id);
  if (l.reply) return l.reply;
  const token = generateToken();
  const { error } = await db().from('polls').update({ organizer_token_hash: sha256Hex(token) }).eq('id', l.poll.id);
  if (error) {
    console.error('master: new token failed', error.code, error.message);
    return serverError();
  }
  const base = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
  return ok({ organizerUrl: `${base}/o/${token}` });
}

// ---------------- projektek ----------------

async function projectCreate(body: Body): Promise<Reply> {
  const name = cleanName(body.name);
  if (!name) return fail(400, 'name_invalid');
  const { data, error } = await db().from('s2v_projects').insert({ name }).select('id').single();
  if (error) {
    if (error.code === '23505') return fail(409, 'name_taken');
    console.error('master: project create failed', error.code, error.message);
    return serverError();
  }
  return ok({ id: data?.id }, 201);
}

async function projectRename(body: Body): Promise<Reply> {
  if (!isUuid(body.id)) return fail(400, 'invalid_request');
  const name = cleanName(body.name);
  if (!name) return fail(400, 'name_invalid');
  const { data, error } = await db().from('s2v_projects').update({ name }).eq('id', body.id).select('id').maybeSingle();
  if (error) {
    if (error.code === '23505') return fail(409, 'name_taken');
    console.error('master: project rename failed', error.code, error.message);
    return serverError();
  }
  return data ? ok() : fail(404, 'not_found');
}

async function projectDelete(body: Body): Promise<Reply> {
  if (!isUuid(body.id)) return fail(400, 'invalid_request');
  // A szavazások és kódok megmaradnak, csak a projekthez kötésük szűnik meg.
  const a = await db().from('polls').update({ project_id: null }).eq('project_id', body.id);
  const b = await db().from('s2v_access_codes').update({ project_id: null }).eq('project_id', body.id);
  if (a.error || b.error) return serverError();
  const { error } = await db().from('s2v_projects').delete().eq('id', body.id);
  if (error) {
    console.error('master: project delete failed', error.code, error.message);
    return serverError();
  }
  return ok();
}

// ---------------- kódtár ----------------

async function codeCreate(body: Body): Promise<Reply> {
  const label = cleanName(body.label);
  if (!label) return fail(400, 'label_invalid');

  let code: string;
  if (body.code === undefined || body.code === null || body.code === '') {
    code = generateAccessCode();
  } else {
    const v = validateAccessCode(body.code);
    if (!v.ok) return fail(400, v.error);
    code = v.value;
  }
  // Az általános belépési kóddal azonos kód nem vehető fel (félreérthető lenne a használata).
  const general = process.env.CREATE_GATE_CODE;
  if (general && safeEqual(code, general)) return fail(409, 'code_taken');

  const projectId = body.projectId ?? null;
  const pe = await checkProject(projectId);
  if (pe) return pe;

  const exp = parseInstantOrNull(body.expiresAt);
  if (!exp.ok) return fail(400, 'expiry_invalid');
  if (exp.value && Date.parse(exp.value) <= Date.now()) return fail(400, 'expiry_past');

  const { data, error } = await db()
    .from('s2v_access_codes')
    .insert({ label, code_hash: hashAccessCode(code), project_id: projectId, expires_at: exp.value })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return fail(409, 'code_taken');
    console.error('master: code create failed', error.code, error.message);
    return serverError();
  }
  // A kód csak most látszik; az adatbázisban csak a lenyomata van.
  return ok({ id: data?.id, code }, 201);
}

async function codeUpdate(body: Body): Promise<Reply> {
  if (!isUuid(body.id)) return fail(400, 'invalid_request');
  const patch: Record<string, unknown> = {};
  if ('label' in body) {
    const label = cleanName(body.label);
    if (!label) return fail(400, 'label_invalid');
    patch.label = label;
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') return fail(400, 'invalid_request');
    patch.active = body.active;
  }
  if ('projectId' in body) {
    const pe = await checkProject(body.projectId);
    if (pe) return pe;
    patch.project_id = body.projectId;
  }
  if ('expiresAt' in body) {
    const exp = parseInstantOrNull(body.expiresAt);
    if (!exp.ok) return fail(400, 'expiry_invalid');
    patch.expires_at = exp.value; // múltbeli érték is megadható: a kód ezzel azonnal lejár
  }
  if (Object.keys(patch).length === 0) return fail(400, 'nothing_to_update');
  const { data, error } = await db().from('s2v_access_codes').update(patch).eq('id', body.id).select('id').maybeSingle();
  if (error) {
    console.error('master: code update failed', error.code, error.message);
    return serverError();
  }
  return data ? ok() : fail(404, 'not_found');
}

async function codeDelete(body: Body): Promise<Reply> {
  if (!isUuid(body.id)) return fail(400, 'invalid_request');
  // A kóddal létrehozott szavazások megmaradnak.
  const a = await db().from('polls').update({ code_id: null }).eq('code_id', body.id);
  if (a.error) return serverError();
  const { error } = await db().from('s2v_access_codes').delete().eq('id', body.id);
  if (error) {
    console.error('master: code delete failed', error.code, error.message);
    return serverError();
  }
  return ok();
}

const ACTIONS: Record<string, (b: Body) => Promise<Reply>> = {
  overview: () => overview(),
  'poll.update': pollUpdate,
  'poll.meta': pollMeta,
  'poll.status': pollStatus,
  'poll.delete': pollDelete,
  'poll.copy': pollCopy,
  'poll.newToken': pollNewToken,
  'project.create': projectCreate,
  'project.rename': projectRename,
  'project.delete': projectDelete,
  'code.create': codeCreate,
  'code.update': codeUpdate,
  'code.delete': codeDelete,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Az áttekintés 5 mp-enként frissül, ezért az általános korlát bőséges.
  if (guard(req, res, 'master', 240)) return;

  try {
    const expected = process.env.MASTER_CODE;
    if (!expected) return send(res, 503, { error: 'master_disabled' });

    // Találgatás ellen: sikertelen próbák után az IP-t percre zároljuk (a helyes kód is 429-et kap).
    if (limitReached(req, 'masterfail', 10)) {
      res.setHeader('Retry-After', '60');
      return send(res, 429, { error: 'rate_limited' });
    }
    const body = (req.body ?? {}) as Body;
    if (typeof body.masterCode !== 'string' || !safeEqual(body.masterCode, expected)) {
      rateLimited(req, 'masterfail', 10);
      return send(res, 401, { error: 'invalid_master_code' });
    }

    if (body.action === 'login') return send(res, 200, { ok: true });
    const fn = typeof body.action === 'string' ? ACTIONS[body.action] : undefined;
    if (!fn) return send(res, 400, { error: 'unknown_action' });

    const r = await fn(body);
    return send(res, r.status, r.body);
  } catch (e) {
    console.error('master failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
