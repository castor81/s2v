import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, requireEnv, send } from './_lib/http.js';
import { hashDevice } from './_lib/crypto.js';
import { effectiveStatus, isDeviceId, isSlug } from './_lib/validate.js';

// POST /api/open  { slug, deviceId }
// A szavazóoldal betöltésekor hívja a kliens: visszaadja a szavazást, és session-t rögzít
// (leadási arány és idő a szavazatig mérőszámokhoz). GET helyett POST, mert van mellékhatása.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, 'open')) return;

  try {
    const { slug, deviceId } = (req.body ?? {}) as Record<string, unknown>;
    if (!isSlug(slug) || !isDeviceId(deviceId)) return send(res, 400, { error: 'invalid_request' });

    const { data: poll, error } = await db()
      .from('polls')
      .select('id, title, options, status, opens_at, closes_at')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      console.error('open: poll lookup failed', error.code, error.message);
      return send(res, 500, { error: 'server_error' });
    }
    if (!poll) return send(res, 404, { error: 'not_found' });

    const status = effectiveStatus(poll);
    const deviceHash = hashDevice(deviceId, requireEnv('DEVICE_SALT'));
    let alreadyVoted = false;

    if (status === 'open') {
      // Csak az első megnyitás számít (ignoreDuplicates): first_seen_at nem íródik felül.
      const { error: upErr } = await db()
        .from('poll_sessions')
        .upsert({ poll_id: poll.id, device_hash: deviceHash }, { onConflict: 'poll_id,device_hash', ignoreDuplicates: true });
      if (upErr) console.error('open: session upsert failed', upErr.code, upErr.message);
    }

    const { data: session } = await db()
      .from('poll_sessions')
      .select('voted_at')
      .eq('poll_id', poll.id)
      .eq('device_hash', deviceHash)
      .maybeSingle();
    alreadyVoted = Boolean(session?.voted_at);

    return send(res, 200, {
      title: poll.title,
      options: poll.options,
      status,
      alreadyVoted,
      opensAt: poll.opens_at,
      closesAt: poll.closes_at,
    });
  } catch (e) {
    console.error('open failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
