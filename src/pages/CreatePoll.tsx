import { useState, type FormEvent } from 'react';
import { useLang, type Localized, type MessageKey } from '../i18n';
import { errorCode, post } from '../lib/api';
import { QrBlock } from '../components/QrBlock';
import { CopyField } from '../components/CopyField';

interface Created {
  slug: string;
  voteUrl: string;
  organizerUrl: string;
}

const MIN = 2;
const MAX = 10;

export function CreatePoll() {
  const { t } = useLang();
  const [gateCode, setGateCode] = useState('');
  const [title, setTitle] = useState<Localized>({ hu: '', en: '' });
  const [options, setOptions] = useState<Localized[]>([{ hu: '', en: '' }, { hu: '', en: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');
  const [created, setCreated] = useState<Created | null>(null);

  function setOption(i: number, lang: 'hu' | 'en', value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [lang]: value } : o)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const r = await post<Created>('/api/create', { gateCode, title, options });
    setBusy(false);
    if (r.ok) {
      setCreated(r.data as Created);
      return;
    }
    const code = errorCode(r);
    if (code === 'invalid_gate_code') setError('errGate');
    else if (r.status === 400) setError('errValidation');
    else if (r.status === 429) setError('errRate');
    else setError('errGeneric');
  }

  if (created) {
    return (
      <>
        <h1>{t('resultTitle')}</h1>
        <QrBlock slug={created.slug} voteUrl={created.voteUrl} />
        <CopyField id="vote-url" label={t('voteLink')} value={created.voteUrl} />
        <CopyField id="org-url" label={t('organizerLink')} value={created.organizerUrl} />
        <p role="note" className="notice warn">
          {t('organizerWarn')}
        </p>
        <button
          type="button"
          className="button"
          onClick={() => {
            setCreated(null);
            setTitle({ hu: '', en: '' });
            setOptions([{ hu: '', en: '' }, { hu: '', en: '' }]);
          }}
        >
          {t('newPoll')}
        </button>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1>{t('createTitle')}</h1>

      <div className="field">
        <label htmlFor="gate">{t('gateCode')}</label>
        <input id="gate" type="password" autoComplete="off" required value={gateCode} aria-describedby="gate-help"
          onChange={(e) => setGateCode(e.target.value)} />
        <span id="gate-help" className="hint">{t('gateHelp')}</span>
      </div>

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

      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? t('creating') : t('createSubmit')}
      </button>
    </form>
  );
}
