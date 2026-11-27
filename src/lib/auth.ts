import { readEditor, writeEditor } from './editor';
import { readSessionCode, writeSessionCode } from './master';

// A belépés csak a böngészőlap munkamenetében él (sessionStorage); kilépéskor törlődik.
export type Auth = { role: 'master'; code: string } | { role: 'editor'; code: string; projectName: string | null };

export function readAuth(): Auth | null {
  const m = readSessionCode();
  if (m) return { role: 'master', code: m };
  const e = readEditor();
  return e ? { role: 'editor', code: e.code, projectName: e.projectName } : null;
}

export function writeAuth(a: Auth | null): void {
  writeSessionCode(a?.role === 'master' ? a.code : '');
  writeEditor(a?.role === 'editor' ? { code: a.code, projectName: a.projectName } : null);
}
