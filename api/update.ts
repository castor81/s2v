import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, send } from './_lib/http.js';
import { sha256Hex } from './_lib/crypto.js';
import { effectiveStatus, isToken } from './_lib/validate.js';
import { planEdit } from './_lib/pollEdit.js';

// POST /api/update  { token, title?, options?, opensAt?, closesAt? }
// A szervező módosíthatja a szavazást:
//  - nyitás előtt (és szavazat nélkül): cím, lehetőségek, nyitás és zárás időpontja;
//  - nyitott szavazásnál: csak a zárás időpontja (meghosszabbítás/rövidítés/törlés);
//  - lezárt szavazásnál semmi (újranyitás: /api/status).
// A mezők jelenléte számít: hiányzó mező = nem módosul, null = törlés (azonnal / kézi zárás).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, 'update', 60)) return;

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isToken(body.token)) return send(res, 400, { error: 'invalid_request' });

    const { data: poll, error } = await db()
      .from('polls')
      .select('id, title, options, status, opens_at, closes_at')
      .eq('organizer_token_hash', sha256Hex(body.token))
      .maybeSingle();
    if (error) {
      console.error('update: poll lookup failed', error.code, error.message);
      return send(res, 500, { error: 'server_error' });
    }
    if (!poll) return send(res, 404, { error: 'not_found' });

    const plan = await planEdit(poll, body, { allowCloseWhenOpen: true });
    if (!plan.ok) return send(res, plan.status, { error: plan.error });

    const { data, error: upErr } = await db()
      .from('polls')
      .update(plan.patch)
      .eq('id', poll.id)
      .select('status, opens_at, closes_at')
      .maybeSingle();
    if (upErr || !data) {
      console.error('update failed', upErr?.code, upErr?.message);
      return send(res, 500, { error: 'server_error' });
    }
    return send(res, 200, { status: effectiveStatus(data), opensAt: data.opens_at, closesAt: data.closes_at });
  } catch (e) {
    console.error('update failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
