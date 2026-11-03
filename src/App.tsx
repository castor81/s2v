import { Link, Route, Routes } from 'react-router-dom';
import { useLang } from './i18n';
import { CreatePoll } from './pages/CreatePoll';
import { VotePage } from './pages/VotePage';
import { DashboardPage } from './pages/DashboardPage';

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
  const { lang, setLang, t } = useLang();
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/brand/nke-hhk-logo.png" alt={t('logoAlt')} width={56} height={56} />
          <span className="brand-text">
            <span>{t('appName')}</span>
            <span className="brand-sub">{t('orgName')}</span>
          </span>
        </Link>
        <div role="group" aria-label={t('language')} className="langswitch">
          {(['hu', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={l === lang ? 'active' : ''}
              aria-pressed={l === lang}
              lang={l}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/uj" element={<CreatePoll />} />
          <Route path="/o/:token" element={<DashboardPage />} />
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
