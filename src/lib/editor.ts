import type { Localized } from '../i18n';

// A szerkesztői munkamenet csak a böngészőlapon él (sessionStorage), kilépéskor törlődik.
const SESSION = 's2v_editor_session';
const POLLS = 's2v_editor_polls';

export interface EditorSession {
  code: string;
  projectName: string | null;
}

export interface MadePoll {
  slug: string;
  voteUrl: string;
  organizerUrl: string;
  title: Localized;
  createdAt: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nem kritikus: a munkamenet a lap állapotában marad */
  }
}

export const readEditor = () => read<EditorSession | null>(SESSION, null);
export const writeEditor = (s: EditorSession | null) => write(SESSION, s);
export const readMade = () => read<MadePoll[]>(POLLS, []);
export const writeMade = (p: MadePoll[] | null) => write(POLLS, p);
