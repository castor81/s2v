import { useLang } from '../i18n';

// Helyőrző: a szervezői dashboard a 2. iterációban készül el (F7).
export function DashboardPage() {
  const { t } = useLang();
  return (
    <>
      <h1>{t('dashboardTitle')}</h1>
      <p>{t('dashboardSoon')}</p>
    </>
  );
}
