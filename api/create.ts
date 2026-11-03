import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, send } from './_lib/http.js';
import { resolveGateCode } from './_lib/codes.js';
import { insertPoll } from './_lib/pollCreate.js';
import { validateCreate, validateSchedule } from './_lib/validate.js';

// POST /api/create  { gateCode, title: {hu,en}, options: [{hu,en}, ...], opensAt?, closesAt? }
// → { slug, voteUrl, organizerUrl }   (a szervezői link csak most jelenik meg, később nem kérhető le)
// A belépési kód lehet az általános (környezeti) kód vagy a master felületen kezelt kódtár egy kódja;
// a projekthez kötött kód a szavazást a saját projektjébe teszi.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A belépési kód találgatása ellen szigorúbb korlát (kérés/perc/IP).
  if (guard(req, res, 'create', 10)) return;

  try {
    const body: unknown = req.body;
    const gate = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).gateCode : undefined;
    const access = await resolveGateCode(gate);
    if (!access) return send(res, 401, { error: 'invalid_gate_code' });

    const parsed = validateCreate(body);
    if (!parsed.ok) return send(res, 400, { error: parsed.error });

    // Időzítés (opcionális): a nyitás akár hetekkel előre is megadható; üresen azonnal nyílik.
    const schedule = validateSchedule(body as Record<string, unknown>);
    if (!schedule.ok) return send(res, 400, { error: schedule.error });

    const created = await insertPoll({
      title: parsed.value.title,
      options: parsed.value.options,
      opensAt: schedule.value.opensAt,
      closesAt: schedule.value.closesAt,
      projectId: access.projectId,
      codeId: access.codeId,
    });
    if (!created.ok) return send(res, 500, { error: created.error });
    return send(res, 201, {
      slug: created.slug,
      voteUrl: created.voteUrl,
      organizerUrl: created.organizerUrl,
    });
  } catch (e) {
    console.error('create failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
