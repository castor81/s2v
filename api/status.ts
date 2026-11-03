import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, send } from './_lib/http.js';
import { sha256Hex } from './_lib/crypto.js';
import { effectiveStatus, isToken } from './_lib/validate.js';

// POST /api/status  { token, action: 'open' | 'close' }
// A szervező lezárhatja vagy újranyithatja a szavazást (F4). A lezárás rögzíti a closed_at
// időpontot (innen számít a 30 napos megőrzés); az újranyitás törli azt és az időablakot is,
// hogy a kézi döntés felülírja a korábbi nyitási/zárási időpontokat.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, 'status', 60)) return;

  try {
    const { token, action } = (req.body ?? {}) as Record<string, unknown>;
    if (!isToken(token) || (action !== 'open' && action !== 'close')) {
      return send(res, 400, { error: 'invalid_request' });
    }

    const patch =
      action === 'close'
        ? { status: 'closed', closed_at: new Date().toISOString() }
        : { status: 'open', closed_at: null, opens_at: null, closes_at: null };

    const { data, error } = await db()
      .from('polls')
      .update(patch)
      .eq('organizer_token_hash', sha256Hex(token))
      .select('status, opens_at, closes_at')
      .maybeSingle();
    if (error) {
      console.error('status: update failed', error.code, error.message);
      return send(res, 500, { error: 'server_error' });
    }
    if (!data) return send(res, 404, { error: 'not_found' });

    return send(res, 200, { status: effectiveStatus(data) });
  } catch (e) {
    console.error('status failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
