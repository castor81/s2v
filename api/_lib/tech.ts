import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './http.js';

// A szavazások technikai lefolyásának naplózása: hívásszám, kimenet és válaszidő percenként
// (s2v_tech_hits), valamint a szerveroldali hibák egyenként (s2v_tech_errors).
// A naplózás nem akadályozhatja a kiszolgálást: minden hiba elnyelődik. Eszköz- és IP-azonosítót nem rögzít.

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;
type Tagged = VercelResponse & {
  __s2vOut?: { status: number; error?: string };
  __s2vPoll?: { id?: string | null; slug?: string | null };
  __s2vNote?: string;
};

/** A válaszhoz tartozó szavazás megjelölése (a kezelő a keresés után hívja). */
export function attachPoll(res: VercelResponse, poll: { id?: string | null; slug?: string | null }): void {
  (res as Tagged).__s2vPoll = poll;
}

/** A hiba szövegének rögzítése (a hibás hívás naplóbejegyzéséhez); a konzolra is ír. */
export function logError(res: VercelResponse, label: string, ...rest: unknown[]): void {
  console.error(label, ...rest);
  (res as Tagged).__s2vNote = [label, ...rest.map((r) => (r instanceof Error ? r.message : String(r)))].join(' ').slice(0, 300);
}

export function noteError(res: VercelResponse, message: string): void {
  (res as Tagged).__s2vNote = message.slice(0, 300);
}

// A gyakori, ismétlődő lekérdezések (élő állás, szervezői dashboard) sikeres hívásait memóriában összegezzük,
// és legfeljebb ~20 mp-enként írjuk ki: a naplózás ne terhelje az adatbázist (a gyorsítótár célja ugyanez).
// Szerver nélküli környezetben a le nem írt összeg elveszhet, ezért ezek a számok közelítőek.
const BUFFERED = new Set(['live', 'results']);
const FLUSH_MS = 20_000;
interface Agg {
  poll_id: string | null;
  slug: string | null;
  endpoint: string;
  outcome: string;
  n: number;
  msSum: number;
  msMax: number;
}
const buffer = new Map<string, Agg>();
let bufferSince = 0;

async function hit(a: Agg): Promise<void> {
  const { error } = await db().rpc('s2v_tech_hit', {
    p_poll_id: a.poll_id,
    p_slug: a.slug,
    p_endpoint: a.endpoint,
    p_outcome: a.outcome,
    p_n: a.n,
    p_ms_sum: a.msSum,
    p_ms_max: a.msMax,
  });
  if (error) console.error('tech hit failed', error.code, error.message);
}

async function flush(): Promise<void> {
  const items = [...buffer.values()];
  buffer.clear();
  bufferSince = 0;
  for (const a of items) await hit(a);
}

async function record(req: VercelRequest, res: Tagged, endpoint: string, ms: number): Promise<void> {
  const out = res.__s2vOut;
  if (!out || out.status === 405) return; // nem POST: nem szavazási hívás
  const outcome = out.status >= 200 && out.status < 300 ? 'ok' : (out.error ?? `http_${out.status}`).slice(0, 40);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const slug = res.__s2vPoll?.slug ?? (typeof body.slug === 'string' && body.slug.length <= 40 ? body.slug : null);
  const pollId = res.__s2vPoll?.id ?? null;
  const agg: Agg = { poll_id: pollId, slug, endpoint, outcome, n: 1, msSum: ms, msMax: ms };

  if (BUFFERED.has(endpoint) && outcome === 'ok') {
    const k = `${slug ?? ''}|${endpoint}|${outcome}`;
    const cur = buffer.get(k);
    if (cur) {
      cur.n += 1;
      cur.msSum += ms;
      cur.msMax = Math.max(cur.msMax, ms);
      cur.poll_id ??= pollId;
    } else {
      buffer.set(k, agg);
    }
    if (!bufferSince) bufferSince = Date.now();
    if (Date.now() - bufferSince >= FLUSH_MS) await flush();
  } else {
    await hit(agg);
  }

  if (out.status >= 500) {
    const { error } = await db().from('s2v_tech_errors').insert({
      poll_id: pollId,
      poll_slug: slug,
      endpoint,
      status: out.status,
      error: out.error ?? null,
      message: res.__s2vNote ?? null,
    });
    if (error) console.error('tech error insert failed', error.code, error.message);
  }
}

/** A kezelő köré: a hívás végén rögzíti a végpontot, a kimenetet és a válaszidőt. */
export function tracked(endpoint: string, handler: Handler): Handler {
  return async (req, res) => {
    const t0 = Date.now();
    try {
      await handler(req, res);
    } finally {
      try {
        await record(req, res as Tagged, endpoint, Date.now() - t0);
      } catch (e) {
        console.error('tech log failed', e);
      }
    }
  };
}

/** Csak teszteléshez: a memóriabeli összegzés azonnali kiírása. */
export async function __flushTechForTests(): Promise<void> {
  await flush();
}
