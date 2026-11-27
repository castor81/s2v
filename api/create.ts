import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, limitReached, rateLimited, send } from './_lib/http.js';
import { resolveGateCode } from './_lib/codes.js';
import { insertPoll } from './_lib/pollCreate.js';
import { validateCreate, validateSchedule } from './_lib/validate.js';
import { audit, titleText } from './_lib/audit.js';

// POST /api/create  { gateCode, title: {hu,en}, options: [{hu,en}, ...], opensAt?, closesAt? }
// → { slug, voteUrl, organizerUrl }   (a szervezői link csak most jelenik meg, később nem kérhető le)
// A belépési kód lehet az általános (környezeti) kód vagy a master felületen kezelt 6 jegyű számkód;
// a projekthez kötött kód a szavazást a saját projektjébe teszi.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A belépési kód találgatása ellen szigorúbb korlát (kérés/perc/IP).
  if (guard(req, res, 'create', 10)) return;

  try {
    const body: unknown = req.body;
    const gate = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).gateCode : undefined;
    // Találgatás ellen: 8 sikertelen próba után az IP-t percre zároljuk (a helyes kód is 429-et kap).
    if (limitReached(req, 'gatefail', 8)) {
      res.setHeader('Retry-After', '60');
      return send(res, 429, { error: 'rate_limited' });
    }
    const checkOnly = typeof body === 'object' && body !== null && (body as Record<string, unknown>).check === true;
    const access = await resolveGateCode(gate, { count: !checkOnly });
    if (!access) {
      rateLimited(req, 'gatefail', 8);
      return send(res, 401, { error: 'invalid_gate_code' });
    }
    // Belépő oldal: csak a kód érvényességét ellenőrizzük, szavazás nem jön létre.
    if (checkOnly) return send(res, 200, { ok: true, projectName: access.projectName });

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
    await audit({
      actorRole: 'editor',
      actorLabel: access.codeLabel ?? 'general',
      codeId: access.codeId,
      action: 'poll.create',
      projectId: access.projectId,
      projectName: access.projectName,
      pollId: created.id,
      pollSlug: created.slug,
      pollTitle: titleText(parsed.value.title),
    });
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
