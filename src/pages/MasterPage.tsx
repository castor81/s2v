import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLang, type MessageKey } from '../i18n';
import {
  masterError,
  masterPost,
  readSessionCode,
  writeSessionCode,
  type Overview,
} from '../lib/master';
import { PollsTab } from '../components/master/PollsTab';
import { ProjectsTab } from '../components/master/ProjectsTab';
import { CodesTab } from '../components/master/CodesTab';

type Tab = 'polls' | 'projects' | 'codes';
const REFRESH_MS = 5000;

function Login({ onLogin }: { onLogin: (code: string) => void }) {
  const { t } = useLang();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await masterPost(code, 'login');
    setBusy(false);
    if (r.ok) onLogin(code);
    else setError(masterError(r));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1>{t('mTitle')}</h1>
      <div className="field">
        <label htmlFor="m-login">{t('mLoginCode')}</label>
        <input id="m-login" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} aria-describedby="m-login-h" />
        <span className="hint" id="m-login-h">
          {t('mLoginHelp')}
        </span>
      </div>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy || !code}>
        {busy ? t('loading') : t('mLogin')}
      </button>
    </form>
  );
}

function Console({ code, onLogout }: { code: string; onLogout: () => void }) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>('polls');
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const r = await masterPost<Overview>(code, 'overview');
    if (!alive.current) return;
    if (r.ok) {
      setData(r.data as Overview);
      setLoadError(false);
      setUpdated(new Date());
    } else if (r.status === 401 || r.status === 503) {
      onLogout();
    } else {
      setLoadError(true);
    }
  }, [code, onLogout]);

  useEffect(() => {
    alive.current = true;
    void reload();
    // Látható lapnál 5 mp-enként frissítünk: a futó szavazások szavazatszámai élőben változnak.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [reload]);

  // A felület titkos kezelőfelület: keresők ne indexeljék.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  const tabs: Array<[Tab, MessageKey]> = [
    ['polls', 'mTabPolls'],
    ['projects', 'mTabProjects'],
    ['codes', 'mTabCodes'],
  ];

  return (
    <>
      <div className="mtop">
        <h1>{t('mTitle')}</h1>
        <button type="button" className="button" onClick={onLogout}>
          {t('mLogout')}
        </button>
      </div>
      <nav aria-label={t('mSections')} className="mtabs">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className="button" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
            {t(label)}
          </button>
        ))}
      </nav>

      {!data ? (
        loadError ? (
          <p role="alert" className="error">
            {t('dashError')}
          </p>
        ) : (
          <p role="status">{t('loading')}</p>
        )
      ) : (
        <>
          {tab === 'polls' && <PollsTab code={code} data={data} reload={reload} />}
          {tab === 'projects' && <ProjectsTab code={code} data={data} reload={reload} />}
          {tab === 'codes' && <CodesTab code={code} data={data} reload={reload} />}
          <p className="hint">
            {t('mAutoRefresh')}
            {updated && ` ${t('updatedAt')}: ${updated.toLocaleTimeString(lang === 'hu' ? 'hu-HU' : 'en-GB')}.`}
          </p>
          {loadError && (
            <p role="alert" className="error">
              {t('dashError')}
            </p>
          )}
        </>
      )}
    </>
  );
}

export function MasterPage() {
  const [code, setCode] = useState(readSessionCode);
  const logout = useCallback(() => {
    writeSessionCode('');
    setCode('');
  }, []);

  if (!code) {
    return (
      <Login
        onLogin={(c) => {
          writeSessionCode(c);
          setCode(c);
        }}
      />
    );
  }
  return <Console code={code} onLogout={logout} />;
}
