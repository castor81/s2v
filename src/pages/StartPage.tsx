import { PadlockSignIn } from '../components/PadlockSignIn';
import { EditorPage } from './EditorPage';
import { MasterPage } from './MasterPage';
import type { Auth } from '../lib/auth';

/** Kezdőoldal: 6 jegyű kódos lakatos belépő; belépés után a kód szerepköre (master / szerkesztő) dönti el a felületet. */
export function StartPage({ auth, setAuth }: { auth: Auth | null; setAuth: (a: Auth | null) => void }) {
  if (!auth) {
    return <PadlockSignIn onSignedIn={(role, code, projectName) => setAuth(role === 'editor' ? { role, code, projectName } : { role, code })} />;
  }
  const logout = () => setAuth(null);
  return auth.role !== 'editor' ? <MasterPage code={auth.code} role={auth.role} onLogout={logout} /> : <EditorPage session={{ code: auth.code, projectName: auth.projectName }} onLogout={logout} />;
}
