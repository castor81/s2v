import { db } from './http.js';
import { safeEqual, sha256Hex } from './crypto.js';
import type { Result } from './validate.js';

export const CODE_DIGITS = 6;
const CODE_RE = new RegExp(`^\\d{${CODE_DIGITS}}$`);

/** A bevitt kód normalizálása: szóköz és kötőjel (tagolás) nélküli számjegyek. */
export function normalizeCode(v: string): string {
  return v.replace(/[\s-]/g, '');
}

/** Szerkesztői kód: pontosan 6 számjegy (tagolhatóan is megadható, pl. 123 456). */
export function validateAccessCode(v: unknown): Result<string> {
  if (typeof v !== 'string') return { ok: false, error: 'code_invalid' };
  const d = normalizeCode(v);
  return CODE_RE.test(d) ? { ok: true, value: d } : { ok: false, error: 'code_invalid' };
}

/** A kódot sózva hash-eljük (az eszközazonosítóval azonos sóval, külön előtaggal). */
export function hashAccessCode(code: string): string {
  const salt = process.env.DEVICE_SALT;
  if (!salt) throw new Error('Hiányzó környezeti változó: DEVICE_SALT');
  return sha256Hex(`${salt}:code:${code}`);
}

export interface GateResult {
  /** A kódtár bejegyzése; null = az általános (környezeti) belépési kód. */
  codeId: string | null;
  /** A kódtár bejegyzésének megnevezése (naplózáshoz); null = általános kód. */
  codeLabel: string | null;
  /** A kódhoz kötött projekt; null = nincs kötés. */
  projectId: string | null;
  /** A projekt neve (megjelenítéshez); null = nincs kötés. */
  projectName: string | null;
}

/**
 * A szavazás-létrehozás belépési kódjának ellenőrzése: az általános (környezeti) kód vagy a kódtár
 * valamelyik aktív, le nem járt kódja. Sikeres használatnál a használat számlálódik.
 */
export async function resolveGateCode(gate: unknown, opts: { count?: boolean } = {}): Promise<GateResult | null> {
  if (typeof gate !== 'string' || gate.length === 0 || gate.length > 128) return null;

  const env = process.env.CREATE_GATE_CODE;
  if (env && safeEqual(gate, env)) return { codeId: null, codeLabel: null, projectId: null, projectName: null };

  const digits = normalizeCode(gate);
  if (!CODE_RE.test(digits)) return null;

  const { data: row, error } = await db()
    .from('s2v_access_codes')
    .select('id, label, project_id, active, expires_at, use_count')
    .eq('code_hash', hashAccessCode(digits))
    .maybeSingle();
  if (error) {
    console.error('gate: code lookup failed', error.code, error.message);
    throw new Error('code_lookup_failed');
  }
  if (!row || !row.active) return null;
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return null;

  // A használat-számlálás hibája nem akadályozza a belépést. Az ellenőrző hívás (belépő oldal) nem számlál.
  if (opts.count !== false) {
    const { error: upErr } = await db()
      .from('s2v_access_codes')
      .update({ use_count: (row.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upErr) console.error('gate: usage update failed', upErr.code, upErr.message);
  }

  let projectName: string | null = null;
  if (row.project_id) {
    const { data: pr } = await db().from('s2v_projects').select('name').eq('id', row.project_id).maybeSingle();
    projectName = pr?.name ?? null;
  }
  return { codeId: row.id, codeLabel: row.label ?? null, projectId: row.project_id ?? null, projectName };
}
