import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, requireEnv, send } from './_lib/http.js';
import { hashDevice } from './_lib/crypto.js';
import { effectiveStatus, isDeviceId, isSlug, type EffectiveStatus, type PollOption } from './_lib/validate.js';
import { buildStats } from './_lib/stats.js';

const CACHE_MS = 2000;
const MAX_ROWS = 5000;

interface Snapshot {
  id: string;
  title: unknown;
  options: PollOption[];
  status: EffectiveStatus;
  closesAt: string | null;
  counts: Record<string, number>;
  votes: number;
}

// Példányonkénti rövid gyorsítótár: 300 szavazó 10 mp-es lekérdezésénél az adatbázis ~2 mp-enként
// kap egyetlen összesítő lekérdezést, nem szavazónként.
const cache = new Map<string, { at: number; snap: Snapshot }>();

async function snapshot(slug: string): Promise<Snapshot | null | 'error'> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.snap;

  const { data: poll, error } = await db()
    .from('polls')
    .select('id, title, options, status, opens_at, closes_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('live: poll lookup failed', error.code, error.message);
    return 'error';
  }
  if (!poll) return null;

  const votes = await db().from('votes').select('option_id').eq('poll_id', poll.id).range(0, MAX_ROWS - 1);
  if (votes.error) {
    console.error('live: votes query failed', votes.error.code);
    return 'error';
  }
  const options = poll.options as PollOption[];
  const stats = buildStats(options.map((o) => o.id), votes.data ?? [], []);
  const snap: Snapshot = {
    id: poll.id,
    title: poll.title,
    options,
    status: effectiveStatus(poll),
    closesAt: poll.closes_at,
    counts: stats.counts,
    votes: stats.votes,
  };
  cache.set(slug, { at: Date.now(), snap });
  if (cache.size > 500) {
    for (const [k, v] of cache) if (Date.now() - v.at >= CACHE_MS) cache.delete(k);
  }
  return snap;
}

// POST /api/live  { slug, deviceId }
// A szavazók élő állása: csak az az eszköz kapja meg, amelyről már szavaztak ebben a szavazásban
// (az eredmény így nem befolyásolja a szavazat leadását). A szervezői mérőszámokat (megnyitások,
// leadási arány, idők) nem tartalmazza, azok csak a szervezői tokennel érhetők el.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Saját kosár: a gyakori frissítés nem fogyasztja el a megnyitás/szavazás korlátját.
  if (guard(req, res, 'live', Number(process.env.RATE_LIMIT_LIVE_PER_MIN ?? 3000))) return;

  try {
    const { slug, deviceId } = (req.body ?? {}) as Record<string, unknown>;
    if (!isSlug(slug) || !isDeviceId(deviceId)) return send(res, 400, { error: 'invalid_request' });

    const snap = await snapshot(slug);
    if (snap === 'error') return send(res, 500, { error: 'server_error' });
    if (!snap) return send(res, 404, { error: 'not_found' });

    const deviceHash = hashDevice(deviceId, requireEnv('DEVICE_SALT'));
    const { data: mine, error } = await db()
      .from('votes')
      .select('id')
      .eq('poll_id', snap.id)
      .eq('device_hash', deviceHash)
      .maybeSingle();
    if (error) {
      console.error('live: own vote lookup failed', error.code);
      return send(res, 500, { error: 'server_error' });
    }
    if (!mine) return send(res, 403, { error: 'vote_first' });

    return send(res, 200, {
      title: snap.title,
      options: snap.options,
      status: snap.status,
      closesAt: snap.closesAt,
      counts: snap.counts,
      votes: snap.votes,
    });
  } catch (e) {
    console.error('live failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
