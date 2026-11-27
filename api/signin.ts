import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, limitReached, rateLimited, send } from './_lib/http.js';
import { normalizeCode, resolveGateCode } from './_lib/codes.js';
import { safeEqual } from './_lib/crypto.js';
import { audit } from './_lib/audit.js';

// POST /api/signin  { code }  → { role: 'master' | 'director' }  vagy  { role: 'editor', projectName }
// Egyetlen belépő oldal: a 6 jegyű kód alapján a szerver dönti el, hogy master vagy szerkesztő lép be.
// A master és a direktor kód (azonos jogosultság) elsőbbséget élvez a szerkesztői kódokkal szemben; a belépés naplózódik. A belépés nem számít a szerkesztői kód felhasználásának.
// Találgatás ellen 8 sikertelen próba után az IP-t percre zároljuk (a helyes kód is 429-et kap).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, 'signin', 20)) return;
  try {
    if (limitReached(req, 'signinfail', 8)) {
      res.setHeader('Retry-After', '60');
      return send(res, 429, { error: 'rate_limited' });
    }
    const body = req.body;
    const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).code : undefined;
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) {
      rateLimited(req, 'signinfail', 8);
      return send(res, 401, { error: 'invalid_code' });
    }

    const matches = (env: string | undefined) => Boolean(env) && (safeEqual(raw, env as string) || safeEqual(normalizeCode(raw), env as string));
    if (matches(process.env.MASTER_CODE)) {
      await audit({ actorRole: 'master', action: 'signin' });
      return send(res, 200, { role: 'master' });
    }
    if (matches(process.env.DIRECTOR_CODE)) {
      await audit({ actorRole: 'director', action: 'signin' });
      return send(res, 200, { role: 'director' });
    }
    const access = await resolveGateCode(raw, { count: false });
    if (access) {
      await audit({
        actorRole: 'editor',
        actorLabel: access.codeLabel ?? 'general',
        codeId: access.codeId,
        action: 'signin',
        projectId: access.projectId,
        projectName: access.projectName,
      });
      return send(res, 200, { role: 'editor', projectName: access.projectName });
    }

    rateLimited(req, 'signinfail', 8);
    return send(res, 401, { error: 'invalid_code' });
  } catch (e) {
    console.error('signin failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
