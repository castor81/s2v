import { useLang } from '../i18n';
import { timeZoneName } from '../lib/time';

interface Props {
  opens: string;
  closes: string;
  setOpens: (v: string) => void;
  setCloses: (v: string) => void;
  /** A nyitás már nem módosítható (a szavazás megnyílt). */
  opensLocked?: boolean;
  idPrefix?: string;
}

/** Nyitás és zárás időpontja (böngésző helyi ideje); üres nyitás = azonnal, üres zárás = kézi lezárás. */
export function ScheduleFields({ opens, closes, setOpens, setCloses, opensLocked, idPrefix = 'sch' }: Props) {
  const { t } = useLang();
  const tz = timeZoneName();
  return (
    <fieldset>
      <legend>{t('scheduleLegend')}</legend>
      <p className="hint" id={`${idPrefix}-help`}>
        {t('scheduleHelp')}
        {tz && ` ${t('timeZone')}: ${tz}.`}
      </p>
      <div className="field">
        <label htmlFor={`${idPrefix}-opens`}>{t('opensAtLabel')}</label>
        <input
          id={`${idPrefix}-opens`}
          type="datetime-local"
          value={opens}
          disabled={opensLocked}
          aria-describedby={`${idPrefix}-help`}
          onChange={(e) => setOpens(e.target.value)}
        />
        <span className="hint">{opensLocked ? t('opensLocked') : t('opensEmptyHint')}</span>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-closes`}>{t('closesAtLabel')}</label>
        <input
          id={`${idPrefix}-closes`}
          type="datetime-local"
          value={closes}
          aria-describedby={`${idPrefix}-help`}
          onChange={(e) => setCloses(e.target.value)}
        />
        <span className="hint">{t('closesEmptyHint')}</span>
      </div>
    </fieldset>
  );
}
