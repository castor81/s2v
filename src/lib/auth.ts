import { readEditor, writeEditor } from './editor';
import { readSessionCode, writeSessionCode } from './master';

const ROLE_KEY = 's2v_master_role';
function readMasterRole(): 'master' | 'director' {
  try {
    return sessionStorage.getItem(ROLE_KEY) === 'director' ? 'director' : 'master';
  } catch {
    return 'master';
  }
}
function writeMasterRole(r: 'master' | 'director' | null): void {
  try {
    if (r) sessionStorage.setItem(ROLE_KEY, r);
    else sessionStorage.removeItem(ROLE_KEY);
  } catch {
    /* nem kritikus */
  }
}

// A belépés csak a böngészőlap munkamenetében él (sessionStorage); kilépéskor törlődik.
export type Auth = { role: 'master' | 'director'; code: string } | { role: 'editor'; code: string; projectName: string | null };

export function readAuth(): Auth | null {
  const m = readSessionCode();
  if (m) return { role: readMasterRole(), code: m };
  const e = readEditor();
  return e ? { role: 'editor', code: e.code, projectName: e.projectName } : null;
}

export function writeAuth(a: Auth | null): void {
  writeSessionCode(a && a.role !== 'editor' ? a.code : '');
  writeMasterRole(a && a.role !== 'editor' ? a.role : null);
  writeEditor(a?.role === 'editor' ? { code: a.code, projectName: a.projectName } : null);
}
