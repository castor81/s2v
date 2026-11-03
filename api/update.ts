import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, send } from './_lib/http.js';
import { sha256Hex } from './_lib/crypto.js';
import { effectiveStatus, isToken, validateCreate, validateSchedule } from './_lib/validate.js';

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

    const eff = effectiveStatus(poll);
    if (eff === 'closed') return send(res, 409, { error: 'closed' });

    const hasContent = 'title' in body || 'options' in body;
    const hasOpens = 'opensAt' in body;
    const hasCloses = 'closesAt' in body;
    if (!hasContent && !hasOpens && !hasCloses) return send(res, 400, { error: 'nothing_to_update' });

    const patch: Record<string, unknown> = {};

    if (eff === 'open') {
      // Már megnyílt: a tartalom és a nyitás rögzített, csak a zárás módosítható.
      if (hasContent || hasOpens) return send(res, 409, { error: 'already_open' });
      const s = validateSchedule({ opensAt: null, closesAt: body.closesAt });
      if (!s.ok) return send(res, 400, { error: s.error });
      patch.closes_at = s.value.closesAt;
    } else {
      // upcoming: szavazat nem lehet, de a biztonság kedvéért ellenőrizzük.
      const { count, error: cErr } = await db()
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('poll_id', poll.id);
      if (cErr) {
        console.error('update: votes count failed', cErr.code, cErr.message);
        return send(res, 500, { error: 'server_error' });
      }
      if ((count ?? 0) > 0) return send(res, 409, { error: 'already_open' });

      if (hasContent) {
        if (!('title' in body) || !('options' in body)) return send(res, 400, { error: 'content_incomplete' });
        const parsed = validateCreate({ title: body.title, options: body.options });
        if (!parsed.ok) return send(res, 400, { error: parsed.error });
        patch.title = parsed.value.title;
        patch.options = parsed.value.options;
      }
      if (hasOpens || hasCloses) {
        const s = validateSchedule({
          opensAt: hasOpens ? body.opensAt : poll.opens_at,
          closesAt: hasCloses ? body.closesAt : poll.closes_at,
        });
        if (!s.ok) return send(res, 400, { error: s.error });
        patch.opens_at = s.value.opensAt;
        patch.closes_at = s.value.closesAt;
      }
    }

    const { data, error: upErr } = await db()
      .from('polls')
      .update(patch)
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
