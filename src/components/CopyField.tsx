import { useState } from 'react';
import { useLang } from '../i18n';

export function CopyField({ label, value, id }: { label: string; value: string; id: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      /* a mező kijelölhető, kézzel is másolható */
    }
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="button" onClick={copy}>
          {done ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}
