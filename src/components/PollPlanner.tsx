import { useState, type FormEvent } from 'react';
import { useLang, type Localized, type MessageKey } from '../i18n';
import { errorCode, type ApiResult } from '../lib/api';
import { formatDateTime, toIso } from '../lib/time';
import type { MProject } from '../lib/master';
import { QrBlock } from './QrBlock';
import { CopyField } from './CopyField';
import { ContentFields } from './ContentFields';
import { ScheduleFields } from './ScheduleFields';

export interface CreatedPoll {
  slug: string;
  voteUrl: string;
  organizerUrl: string;
}

export interface PlannerInput {
  title: Localized;
  options: Localized[];
  opensAt: string | null;
  closesAt: string | null;
  projectId: string | null;
}

interface Props {
  submit: (p: PlannerInput) => Promise<ApiResult<CreatedPoll>>;
  /** Master: projekt választható. */
  projects?: MProject[];
  /** Szerkesztő: a kódhoz kötött projekt neve (csak kiírjuk). */
  fixedProject?: string | null;
  onCreated?: (c: CreatedPoll, title: Localized) => void;
  onUnauthorized?: () => void;
}

const blank = (): Localized[] => [{ hu: '', en: '' }, { hu: '', en: '' }];

/** Szavazástervező: tartalom, időzítés, (projekt) → létrehozás, QR és hivatkozások. Szerkesztő és master közös űrlapja. */
export function PollPlanner({ submit, projects, fixedProject, onCreated, onUnauthorized }: Props) {
  const { t, lang } = useLang();
  const [title, setTitle] = useState<Localized>({ hu: '', en: '' });
  const [options, setOptions] = useState<Localized[]>(blank());
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');
  const [created, setCreated] = useState<CreatedPoll | null>(null);
  const [sched, setSched] = useState<{ opensAt: string | null; closesAt: string | null }>({ opensAt: null, closesAt: null });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const opensAt = toIso(opens);
    const closesAt = toIso(closes);
    const r = await submit({ title, options, opensAt, closesAt, projectId: projectId || null });
    setBusy(false);
    if (r.ok) {
      const c = r.data as CreatedPoll;
      setSched({ opensAt, closesAt });
      setCreated(c);
      onCreated?.(c, title);
      return;
    }
    const code = errorCode(r);
    if (r.status === 401) {
      onUnauthorized?.();
      setError('errGate');
    } else if (/^(opens_|closes_|window_)/.test(code)) setError('errSchedule');
    else if (code === 'project_not_found') setError('mErrProject');
    else if (r.status === 400) setError('errValidation');
    else if (r.status === 429) setError('errRate');
    else setError('errGeneric');
  }

  function reset() {
    setCreated(null);
    setTitle({ hu: '', en: '' });
    setOptions(blank());
    setOpens('');
    setCloses('');
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
        <button type="button" className="button" onClick={reset}>
          {t('newPoll')}
        </button>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1>{t('navPlanner')}</h1>

      {fixedProject && (
        <p className="notice">
          {t('plFixedProject')}: <strong>{fixedProject}</strong>
        </p>
      )}
      {projects && (
        <div className="field">
          <label htmlFor="pl-project">{t('mProject')}</label>
          <select id="pl-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('mNoProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
