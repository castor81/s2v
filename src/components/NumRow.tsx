import { useLang } from '../i18n';

interface Props {
  /** Az eddig beírt számjegyek (szóköz nélkül). */
  value: string;
  onChange: (digits: string) => void;
  max: number;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Kattintható számsor: 1–9, 0, törlés (⌫) és mindent töröl; érintőképernyőn és egérrel is jól használható. */
export function NumRow({ value, onChange, max, disabled }: Props) {
  const { t } = useLang();
  return (
    <div className="numrow" role="group" aria-label={t('nrLabel')}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className="numkey"
          disabled={disabled || value.length >= max}
          onClick={() => onChange((value + k).slice(0, max))}
        >
          {k}
        </button>
      ))}
      <button type="button" className="numkey wide" disabled={disabled || value.length === 0} onClick={() => onChange(value.slice(0, -1))} aria-label={t('nrBackspace')}>
        ⌫
      </button>
      <button type="button" className="numkey wide" disabled={disabled || value.length === 0} onClick={() => onChange('')}>
        {t('nrClear')}
      </button>
    </div>
  );
}
