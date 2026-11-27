import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useLang } from './i18n';
import { EditorPage } from './pages/EditorPage';
import { LangSwitch } from './components/LangSwitch';
import { VotePage } from './pages/VotePage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterPage } from './pages/MasterPage';

function Home() {
  const { t } = useLang();
  return (
    <>
      <p>{t('home')}</p>
      <p>
        <Link className="button" to="/uj">
          {t('homeCreate')}
        </Link>
      </p>
    </>
  );
}

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
  const wide = path.startsWith('/master');
  const workspace = wide || path === '/uj';
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
          <Route path="/" element={<Home />} />
          <Route path="/uj" element={<EditorPage />} />
          <Route path="/o/:token" element={<DashboardPage />} />
          <Route path="/master" element={<MasterPage />} />
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
