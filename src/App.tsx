import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLang } from './i18n';
import { StartPage } from './pages/StartPage';
import { readAuth, writeAuth, type Auth } from './lib/auth';
import { LangSwitch } from './components/LangSwitch';
import { VotePage } from './pages/VotePage';
import { DashboardPage } from './pages/DashboardPage';

function NotFound() {
  const { t } = useLang();
  return (
    <>
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFoundText')}</p>
    </>
  );
}

export function App() {
  const { t } = useLang();
  const path = useLocation().pathname;
  const [auth, setAuthState] = useState<Auth | null>(readAuth);
  const setAuth = (a: Auth | null) => {
    writeAuth(a);
    setAuthState(a);
  };
  const workspace = path === '/';
  const wide = workspace && auth?.role === 'master';
  return (
    <div className={wide ? 'shell wide' : 'shell'}>
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/brand/nke-hhk-logo.png" alt={t('logoAlt')} width={56} height={56} />
          <span className="brand-text">
            <span>{t('appName')}</span>
            <span className="brand-sub">{t('orgName')}</span>
          </span>
        </Link>
        <LangSwitch />
      </header>
      <main id="main" className={workspace ? 'flat' : undefined}>
        <Routes>
          <Route path="/" element={<StartPage auth={auth} setAuth={setAuth} />} />
          <Route path="/uj" element={<Navigate to="/" replace />} />
          <Route path="/o/:token" element={<DashboardPage />} />
          <Route path="/master" element={<Navigate to="/" replace />} />
          <Route path="/:slug" element={<VotePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        {/* Dekoratív: a név szövegként is szerepel mellette */}
        <img src="/brand/nke-logo.png" alt="" width={48} height={48} />
        <span>{t('footerText')}</span>
      </footer>
    </div>
  );
}
