import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, requireEnv, send } from './_lib/http.js';
import { hashDevice } from './_lib/crypto.js';
import { effectiveStatus, isDeviceId, isSlug, type PollOption } from './_lib/validate.js';

// POST /api/vote  { slug, deviceId, optionId }
// Eszközönként egy szavazat szavazásonként: az adatbázis UNIQUE (poll_id, device_hash) megszorítása
// dönt, így párhuzamos kéréseknél sem lehet duplikátum.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, 'vote')) return;

  try {
    const { slug, deviceId, optionId } = (req.body ?? {}) as Record<string, unknown>;
    if (!isSlug(slug) || !isDeviceId(deviceId) || typeof optionId !== 'string') {
      return send(res, 400, { error: 'invalid_request' });
    }

    const { data: poll, error } = await db()
      .from('polls')
      .select('id, options, status, opens_at, closes_at')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      console.error('vote: poll lookup failed', error.code, error.message);
      return send(res, 500, { error: 'server_error' });
    }
    if (!poll) return send(res, 404, { error: 'not_found' });

    if (effectiveStatus(poll) !== 'open') return send(res, 409, { error: 'not_open' });
    if (!(poll.options as PollOption[]).some((o) => o.id === optionId)) {
      return send(res, 400, { error: 'invalid_option' });
    }

    const deviceHash = hashDevice(deviceId, requireEnv('DEVICE_SALT'));
    const { error: voteErr } = await db()
      .from('votes')
      .insert({ poll_id: poll.id, option_id: optionId, device_hash: deviceHash });
    if (voteErr) {
      if (voteErr.code === '23505') return send(res, 409, { error: 'already_voted' });
      console.error('vote: insert failed', voteErr.code, voteErr.message);
      return send(res, 500, { error: 'server_error' });
    }

    // voted_at csak a mérőszámokhoz kell; ha ez elbukik, a szavazat attól még érvényes.
    const { error: sessErr } = await db()
      .from('poll_sessions')
      .upsert(
        { poll_id: poll.id, device_hash: deviceHash, voted_at: new Date().toISOString() },
        { onConflict: 'poll_id,device_hash' },
      );
    if (sessErr) console.error('vote: session update failed', sessErr.code, sessErr.message);

    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('vote failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
