import { useLang, type Localized } from '../i18n';

const MIN = 2;
const MAX = 10;

interface Props {
  title: Localized;
  setTitle: (t: Localized) => void;
  options: Localized[];
  setOptions: (o: Localized[]) => void;
}

/** A szavazás tartalma: kétnyelvű cím és 2–10 válaszlehetőség (létrehozáshoz és módosításhoz közös). */
export function ContentFields({ title, setTitle, options, setOptions }: Props) {
  const { t } = useLang();

  function setOption(i: number, lang: 'hu' | 'en', value: string) {
    setOptions(options.map((o, idx) => (idx === i ? { ...o, [lang]: value } : o)));
  }

  return (
    <>
      <p className="hint">{t('langHint')}</p>

      <div className="field">
        <label htmlFor="title-hu">{t('pollTitleHu')}</label>
        <input id="title-hu" maxLength={120} value={title.hu ?? ''} onChange={(e) => setTitle({ ...title, hu: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="title-en">{t('pollTitleEn')}</label>
        <input id="title-en" maxLength={120} value={title.en ?? ''} onChange={(e) => setTitle({ ...title, en: e.target.value })} />
      </div>

      <fieldset>
        <legend>{t('optionsLegend')}</legend>
        {options.map((o, i) => (
          <div key={i} className="option-row">
            <div className="field">
              <label htmlFor={`o-${i}-hu`}>{`${t('optionN')} ${i + 1} · ${t('optionHu')}`}</label>
              <input id={`o-${i}-hu`} maxLength={80} value={o.hu ?? ''} onChange={(e) => setOption(i, 'hu', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`o-${i}-en`}>{`${t('optionN')} ${i + 1} · ${t('optionEn')}`}</label>
              <input id={`o-${i}-en`} maxLength={80} value={o.en ?? ''} onChange={(e) => setOption(i, 'en', e.target.value)} />
            </div>
            {options.length > MIN && (
              <button type="button" className="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                {t('removeOption')} ({i + 1})
              </button>
            )}
          </div>
        ))}
        {options.length < MAX && (
          <button type="button" className="button" onClick={() => setOptions([...options, { hu: '', en: '' }])}>
            {t('addOption')}
          </button>
        )}
      </fieldset>
    </>
  );
}
