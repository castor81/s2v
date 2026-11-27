import { useLang } from '../i18n';

/** Nyelvváltó "billenő" kapcsoló (HU ⇄ EN): egyetlen gomb, amely a kapcsoló szerepét tölti be. */
export function LangSwitch() {
  const { lang, setLang, t } = useLang();
  const en = lang === 'en';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={en}
      aria-label={`${t('language')}: ${en ? 'English' : 'Magyar'}`}
      className={`rocker${en ? ' on' : ''}`}
      onClick={() => setLang(en ? 'hu' : 'en')}
    >
      <span className="rocker-well" aria-hidden="true">
        <span className="rocker-cast" />
        <span className="rocker-opt" lang="hu">
          HU
        </span>
        <span className="rocker-opt" lang="en">
          EN
        </span>
      </span>
    </button>
  );
}
