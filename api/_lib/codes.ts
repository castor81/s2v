import { db } from './http.js';
import { safeEqual, sha256Hex } from './crypto.js';
import type { Result } from './validate.js';

export const CODE_MIN = 8;
export const CODE_MAX = 64;

/** Egyedi szerkesztői kód: 8–64 karakter, szóköz nélkül. */
export function validateAccessCode(v: unknown): Result<string> {
  if (typeof v !== 'string') return { ok: false, error: 'code_invalid' };
  const t = v.trim();
  if (t.length < CODE_MIN) return { ok: false, error: 'code_too_short' };
  if (t.length > CODE_MAX || /\s/.test(t)) return { ok: false, error: 'code_invalid' };
  return { ok: true, value: t };
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
  /** A kódhoz kötött projekt; null = nincs kötés. */
  projectId: string | null;
}

/**
 * A szavazás-létrehozás belépési kódjának ellenőrzése: az általános (környezeti) kód vagy a kódtár
 * valamelyik aktív, le nem járt kódja. Sikeres használatnál a használat számlálódik.
 */
export async function resolveGateCode(gate: unknown): Promise<GateResult | null> {
  if (typeof gate !== 'string' || gate.length === 0 || gate.length > CODE_MAX + 64) return null;

  const env = process.env.CREATE_GATE_CODE;
  if (env && safeEqual(gate, env)) return { codeId: null, projectId: null };

  const { data: row, error } = await db()
    .from('s2v_access_codes')
    .select('id, project_id, active, expires_at, use_count')
    .eq('code_hash', hashAccessCode(gate.trim()))
    .maybeSingle();
  if (error) {
    console.error('gate: code lookup failed', error.code, error.message);
    throw new Error('code_lookup_failed');
  }
  if (!row || !row.active) return null;
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return null;

  // A használat-számlálás hibája nem akadályozza a létrehozást.
  const { error: upErr } = await db()
    .from('s2v_access_codes')
    .update({ use_count: (row.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', row.id);
  if (upErr) console.error('gate: usage update failed', upErr.code, upErr.message);

  return { codeId: row.id, projectId: row.project_id ?? null };
}
