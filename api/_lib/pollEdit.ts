import { db } from './http.js';
import { effectiveStatus, validateCreate, validateSchedule } from './validate.js';

export type EditPlan = { ok: true; patch: Record<string, unknown> } | { ok: false; status: number; error: string };

/**
 * Szavazás módosításának terve (a szervezői és a master végpont közös szabályai):
 *  - nyitás előtt (és szavazat nélkül): cím, lehetőségek, nyitás és zárás;
 *  - nyitott szavazásnál: csak a zárás (ha `allowCloseWhenOpen`), különben tiltott;
 *  - lezárt szavazásnál semmi.
 * A mezők jelenléte számít: hiányzó mező = nem módosul, null = törlés.
 */
export async function planEdit(
  poll: { id: string; status: string; opens_at: string | null; closes_at: string | null },
  body: Record<string, unknown>,
  opts: { allowCloseWhenOpen: boolean },
): Promise<EditPlan> {
  const eff = effectiveStatus(poll);
  if (eff === 'closed') return { ok: false, status: 409, error: 'closed' };

  const hasContent = 'title' in body || 'options' in body;
  const hasOpens = 'opensAt' in body;
  const hasCloses = 'closesAt' in body;
  if (!hasContent && !hasOpens && !hasCloses) return { ok: false, status: 400, error: 'nothing_to_update' };

  const patch: Record<string, unknown> = {};

  if (eff === 'open') {
    if (!opts.allowCloseWhenOpen || hasContent || hasOpens) return { ok: false, status: 409, error: 'already_open' };
    const s = validateSchedule({ opensAt: null, closesAt: body.closesAt });
    if (!s.ok) return { ok: false, status: 400, error: s.error };
    patch.closes_at = s.value.closesAt;
    return { ok: true, patch };
  }

  // upcoming: szavazat nem lehet, de a biztonság kedvéért ellenőrizzük.
  const { count, error: cErr } = await db()
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', poll.id);
  if (cErr) {
    console.error('edit: votes count failed', cErr.code, cErr.message);
    return { ok: false, status: 500, error: 'server_error' };
  }
  if ((count ?? 0) > 0) return { ok: false, status: 409, error: 'already_open' };

  if (hasContent) {
    if (!('title' in body) || !('options' in body)) return { ok: false, status: 400, error: 'content_incomplete' };
    const parsed = validateCreate({ title: body.title, options: body.options });
    if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
    patch.title = parsed.value.title;
    patch.options = parsed.value.options;
  }
  if (hasOpens || hasCloses) {
    const s = validateSchedule({
      opensAt: hasOpens ? body.opensAt : poll.opens_at,
      closesAt: hasCloses ? body.closesAt : poll.closes_at,
    });
    if (!s.ok) return { ok: false, status: 400, error: s.error };
    patch.opens_at = s.value.opensAt;
    patch.closes_at = s.value.closesAt;
  }
  return { ok: true, patch };
}
