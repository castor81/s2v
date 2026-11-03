import { useState, type FormEvent } from 'react';
import { useLang, type Localized, type MessageKey } from '../i18n';
import { errorCode, post } from '../lib/api';
import { QrBlock } from '../components/QrBlock';
import { CopyField } from '../components/CopyField';
import { ContentFields } from '../components/ContentFields';
import { ScheduleFields } from '../components/ScheduleFields';
import { formatDateTime, toIso } from '../lib/time';

interface Created {
  slug: string;
  voteUrl: string;
  organizerUrl: string;
}

export function CreatePoll() {
  const { t, lang } = useLang();
  const [gateCode, setGateCode] = useState('');
  const [title, setTitle] = useState<Localized>({ hu: '', en: '' });
  const [options, setOptions] = useState<Localized[]>([{ hu: '', en: '' }, { hu: '', en: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');
  const [created, setCreated] = useState<Created | null>(null);
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [sched, setSched] = useState<{ opensAt: string | null; closesAt: string | null }>({ opensAt: null, closesAt: null });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const opensAt = toIso(opens);
    const closesAt = toIso(closes);
    const r = await post<Created>('/api/create', { gateCode, title, options, opensAt, closesAt });
    setBusy(false);
    if (r.ok) {
      setSched({ opensAt, closesAt });
      setCreated(r.data as Created);
      return;
    }
    const code = errorCode(r);
    if (code === 'invalid_gate_code') setError('errGate');
    else if (/^(opens_|closes_|window_)/.test(code)) setError('errSchedule');
    else if (r.status === 400) setError('errValidation');
    else if (r.status === 429) setError('errRate');
    else setError('errGeneric');
  }

  if (created) {
    return (
      <>
        <h1>{t('resultTitle')}</h1>
        <p>
          {t('scheduleOpens')}: {sched.opensAt && new Date(sched.opensAt) > new Date() ? formatDateTime(sched.opensAt, lang) : t('scheduleNow')}
          <br />
          {t('scheduleCloses')}: {sched.closesAt ? formatDateTime(sched.closesAt, lang) : t('scheduleManual')}
        </p>
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
            setOpens('');
            setCloses('');
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

      <ContentFields title={title} setTitle={setTitle} options={options} setOptions={setOptions} />

      <ScheduleFields opens={opens} closes={closes} setOpens={setOpens} setCloses={setCloses} />

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
