import { useLang, type Localized } from '../i18n';

const MIN = 2;
const MAX = 10;

interface Props {
  title: Localized;
  setTitle: (t: Localized) => void;
  options: Localized[];
  setOptions: (o: Localized[]) => void;
}

/** Egyetlen megjelenített szöveg (a felületi nyelv váltása nem fordítja a szavazás tartalmát). */
const text = (l: Localized) => l.hu ?? l.en ?? '';
/** A szöveget mindkét nyelvi mezőbe írjuk, így a szavazó a nyelvétől függetlenül ugyanazt látja. */
const both = (v: string): Localized => ({ hu: v, en: v });

/** A szavazás tartalma: cím és 2–10 válaszlehetőség (létrehozáshoz és módosításhoz közös). */
export function ContentFields({ title, setTitle, options, setOptions }: Props) {
  const { t } = useLang();

  return (
    <>
      <div className="field">
        <label htmlFor="poll-title">{t('pollTitle')}</label>
        <input id="poll-title" maxLength={120} value={text(title)} onChange={(e) => setTitle(both(e.target.value))} />
      </div>

      <fieldset>
        <legend>{t('optionsLegend')}</legend>
        {options.map((o, i) => (
          <div key={i} className="option-row">
            <div className="field">
              <label htmlFor={`o-${i}`}>{`${t('optionN')} ${i + 1}`}</label>
              <input
                id={`o-${i}`}
                maxLength={80}
                value={text(o)}
                onChange={(e) => setOptions(options.map((x, idx) => (idx === i ? both(e.target.value) : x)))}
              />
            </div>
            {options.length > MIN && (
              <button type="button" className="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                {t('removeOption')} ({i + 1})
              </button>
            )}
          </div>
        ))}
        {options.length < MAX && (
          <button type="button" className="button" onClick={() => setOptions([...options, both('')])}>
            {t('addOption')}
          </button>
        )}
      </fieldset>
    </>
  );
}
