import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, requireEnv, send } from './_lib/http.js';
import { generateSlug, generateToken, safeEqual, sha256Hex } from './_lib/crypto.js';
import { validateCreate, validateSchedule } from './_lib/validate.js';

// POST /api/create  { gateCode, title: {hu,en}, options: [{hu,en}, ...], opensAt?, closesAt? }
// → { slug, voteUrl, organizerUrl }   (a szervezői link csak most jelenik meg, később nem kérhető le)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A belépési kód találgatása ellen szigorúbb korlát (kérés/perc/IP).
  if (guard(req, res, 'create', 10)) return;

  try {
    const body: unknown = req.body;
    const gate = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).gateCode : undefined;
    if (typeof gate !== 'string' || !safeEqual(gate, requireEnv('CREATE_GATE_CODE'))) {
      return send(res, 401, { error: 'invalid_gate_code' });
    }

    const parsed = validateCreate(body);
    if (!parsed.ok) return send(res, 400, { error: parsed.error });

    // Időzítés (opcionális): a nyitás akár hetekkel előre is megadható; üresen azonnal nyílik.
    const schedule = validateSchedule(body as Record<string, unknown>);
    if (!schedule.ok) return send(res, 400, { error: schedule.error });

    const baseUrl = requireEnv('BASE_URL').replace(/\/+$/, '');
    const token = generateToken();
    const tokenHash = sha256Hex(token);

    // A slug-ütközés (23505) elvileg ritka; néhányszor újrapróbáljuk.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = generateSlug();
      const { error } = await db().from('polls').insert({
        slug,
        title: parsed.value.title,
        options: parsed.value.options,
        status: 'open',
        opens_at: schedule.value.opensAt,
        closes_at: schedule.value.closesAt,
        organizer_token_hash: tokenHash,
      });
      if (!error) {
        return send(res, 201, {
          slug,
          voteUrl: `${baseUrl}/${slug}`,
          organizerUrl: `${baseUrl}/o/${token}`,
        });
      }
      if (error.code !== '23505') {
        console.error('create poll failed', error.code, error.message);
        return send(res, 500, { error: 'server_error' });
      }
    }
    return send(res, 500, { error: 'slug_collision' });
  } catch (e) {
    console.error('create failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
