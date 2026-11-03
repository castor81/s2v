export type Localized = { hu?: string; en?: string };

export interface PollOption {
  id: string;
  hu?: string;
  en?: string;
}

export interface ValidCreate {
  title: Localized;
  options: PollOption[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const TITLE_MAX = 120;
export const OPTION_MAX = 80;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 10;

const SLUG_RE = /^[a-z0-9]{6}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;
// 32 véletlen bájt base64url kódolásban = 43 karakter (lásd generateToken)
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isToken(v: unknown): v is string {
  return typeof v === 'string' && TOKEN_RE.test(v);
}

export function isSlug(v: unknown): v is string {
  return typeof v === 'string' && SLUG_RE.test(v);
}

export function isDeviceId(v: unknown): v is string {
  return typeof v === 'string' && DEVICE_RE.test(v);
}

function cleanLocalized(raw: unknown, max: number): Result<Localized> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'invalid_text' };
  const out: Localized = {};
  for (const lang of ['hu', 'en'] as const) {
    const v = (raw as Record<string, unknown>)[lang];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string') return { ok: false, error: 'invalid_text' };
    const t = v.trim();
    if (t.length > max) return { ok: false, error: 'text_too_long' };
    if (t) out[lang] = t;
  }
  if (!out.hu && !out.en) return { ok: false, error: 'text_required' };
  return { ok: true, value: out };
}

/** A létrehozás-kérés törzsének ellenőrzése (a belépési kódot a hívó kezeli). */
export function validateCreate(body: unknown): Result<ValidCreate> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_body' };
  const b = body as Record<string, unknown>;

  const title = cleanLocalized(b.title, TITLE_MAX);
  if (!title.ok) return { ok: false, error: `title_${title.error}` };

  if (!Array.isArray(b.options)) return { ok: false, error: 'options_required' };
  if (b.options.length < OPTIONS_MIN || b.options.length > OPTIONS_MAX) {
    return { ok: false, error: 'options_count' };
  }

  const options: PollOption[] = [];
  for (let i = 0; i < b.options.length; i++) {
    const o = cleanLocalized(b.options[i], OPTION_MAX);
    if (!o.ok) return { ok: false, error: `option_${i + 1}_${o.error}` };
    options.push({ id: `o${i + 1}`, ...o.value });
  }
  return { ok: true, value: { title: title.value, options } };
}

export type EffectiveStatus = 'upcoming' | 'open' | 'closed';

/** A szavazás tényleges állapota az állapotmező és az időablak alapján. */
export function effectiveStatus(
  poll: { status: string; opens_at: string | null; closes_at: string | null },
  now: Date = new Date(),
): EffectiveStatus {
  if (poll.status === 'closed') return 'closed';
  if (poll.status === 'draft') return 'upcoming';
  if (poll.closes_at && new Date(poll.closes_at) <= now) return 'closed';
  if (poll.opens_at && new Date(poll.opens_at) > now) return 'upcoming';
  return 'open';
}

// ---- Időzítés (2. iteráció): nyitás/zárás időpontja ----

export interface Schedule {
  /** Nyitás (ISO, UTC); null = azonnal. */
  opensAt: string | null;
  /** Zárás (ISO, UTC); null = csak kézi lezárással. */
  closesAt: string | null;
}

export const MAX_AHEAD_DAYS = 366;
export const MIN_WINDOW_SECONDS = 60;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function parseInstant(v: unknown): Result<string | null> {
  if (v === undefined || v === null || v === '') return { ok: true, value: null };
  if (typeof v !== 'string' || !ISO_RE.test(v)) return { ok: false, error: 'invalid_time' };
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return { ok: false, error: 'invalid_time' };
  return { ok: true, value: new Date(t).toISOString() };
}

/**
 * A nyitás/zárás ellenőrzése. A múltbeli nyitás "azonnal" (null). A zárásnak a jövőben kell lennie,
 * a nyitás után legalább 1 perccel, és legfeljebb MAX_AHEAD_DAYS napra előre.
 */
export function validateSchedule(
  raw: { opensAt?: unknown; closesAt?: unknown },
  now: Date = new Date(),
): Result<Schedule> {
  const o = parseInstant(raw.opensAt);
  if (!o.ok) return { ok: false, error: `opens_${o.error}` };
  const c = parseInstant(raw.closesAt);
  if (!c.ok) return { ok: false, error: `closes_${c.error}` };

  const nowMs = now.getTime();
  const limit = nowMs + MAX_AHEAD_DAYS * 86_400_000;

  let opensAt = o.value;
  if (opensAt !== null) {
    const t = Date.parse(opensAt);
    if (t <= nowMs) opensAt = null;
    else if (t > limit) return { ok: false, error: 'opens_too_far' };
  }

  const closesAt = c.value;
  if (closesAt !== null) {
    const t = Date.parse(closesAt);
    if (t <= nowMs) return { ok: false, error: 'closes_in_past' };
    if (t > limit) return { ok: false, error: 'closes_too_far' };
    const start = opensAt !== null ? Date.parse(opensAt) : nowMs;
    if (t - start < MIN_WINDOW_SECONDS * 1000) return { ok: false, error: 'window_too_short' };
  }
  return { ok: true, value: { opensAt, closesAt } };
}
