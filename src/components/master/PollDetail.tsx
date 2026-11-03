import { useState } from 'react';
import { useLang, type MessageKey } from '../../i18n';
import { toIso } from '../../lib/time';
import { formatDateTime } from '../../lib/time';
import { exportPolls } from '../../lib/csv';
import { masterError, masterPost, type MCode, type MPoll, type MProject } from '../../lib/master';
import { ResultsTable } from '../ResultsTable';
import { QrBlock } from '../QrBlock';
import { CopyField } from '../CopyField';
import { ScheduleFields } from '../ScheduleFields';
import { MasterEdit } from './MasterEdit';

interface Props {
  code: string;
  poll: MPoll;
  projects: MProject[];
  codes: MCode[];
  retentionDays: number;
  now: string;
  reload: () => Promise<void>;
}

type Mode = 'none' | 'edit' | 'copy' | 'close' | 'delete' | 'token';
const WARN_DAYS = 7;

/** Egy szavazás részletei és műveletei a master felületen. */
export function PollDetail({ code, poll, projects, codes, retentionDays, now, reload }: Props) {
  const { t, lang } = useLang();
  const [mode, setMode] = useState<Mode>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');
  const [info, setInfo] = useState<MessageKey | ''>('');
  const [issued, setIssued] = useState<{ organizerUrl: string; voteUrl?: string; kind: 'copy' | 'token' } | null>(null);
  const [copyOpens, setCopyOpens] = useState('');
  const [copyCloses, setCopyCloses] = useState('');

  const { stats } = poll;
  const nf = new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', { maximumFractionDigits: 1 });
  const completion = stats.sessions > 0 ? `${nf.format((stats.votes / stats.sessions) * 100)} %` : t('noData');
  const code_ = codes.find((c) => c.id === poll.codeId);
  const daysLeft = poll.purgeAt ? Math.ceil((Date.parse(poll.purgeAt) - Date.parse(now)) / 86_400_000) : null;

  /** Közös végrehajtó: sikernél frissít, hibánál üzenetet ad. */
  async function run(action: string, extra: Record<string, unknown>, done?: MessageKey): Promise<boolean> {
    setBusy(true);
    setError('');
    setInfo('');
    const r = await masterPost(code, action, { id: poll.id, ...extra });
    setBusy(false);
    if (!r.ok) {
      setError(masterError(r));
      return false;
    }
    if (done) setInfo(done);
    await reload();
    return true;
  }

  async function doCopy() {
    setBusy(true);
    setError('');
    const r = await masterPost<{ organizerUrl: string; voteUrl: string }>(code, 'poll.copy', {
      id: poll.id,
      opensAt: toIso(copyOpens),
      closesAt: toIso(copyCloses),
    });
    setBusy(false);
    if (!r.ok) {
      setError(masterError(r));
      return;
    }
    const d = r.data as { organizerUrl: string; voteUrl: string };
    setIssued({ ...d, kind: 'copy' });
    setMode('none');
    await reload();
  }

  async function doToken() {
    setBusy(true);
    setError('');
    const r = await masterPost<{ organizerUrl: string }>(code, 'poll.newToken', { id: poll.id });
    setBusy(false);
    if (!r.ok) {
      setError(masterError(r));
      return;
    }
    setIssued({ organizerUrl: (r.data as { organizerUrl: string }).organizerUrl, kind: 'token' });
    setMode('none');
  }

  const confirm = (key: MessageKey, onYes: () => void, yesKey: MessageKey) => (
    <div role="alertdialog" aria-label={t(key)} className="notice warn">
      <p>{t(key)}</p>
      <div className="row">
        <button type="button" className="button primary" disabled={busy} onClick={onYes}>
          {t(yesKey)}
        </button>
        <button type="button" className="button" onClick={() => setMode('none')}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mdetail">
      <dl className="stats">
        <div className="stat">
          <dt>{t('statVotes')}</dt>
          <dd>{stats.votes}</dd>
        </div>
        <div className="stat">
          <dt>{t('statSessions')}</dt>
          <dd>{stats.sessions}</dd>
        </div>
        <div className="stat">
          <dt>{t('statCompletion')}</dt>
          <dd>{completion}</dd>
        </div>
      </dl>

      <ResultsTable options={poll.options} counts={stats.counts} total={stats.votes} />
      {stats.votes === 0 && <p>{t('noVotesYet')}</p>}

      <p className="schedule">
        {t('mCreated')}: {formatDateTime(poll.createdAt, lang)}
        {code_ && ` · ${t('mCreatedWith')}: ${code_.label}`}
        <br />
        {t('scheduleOpens')}: {poll.opensAt ? formatDateTime(poll.opensAt, lang) : t('scheduleNow')}
        <br />
        {t('scheduleCloses')}: {poll.closesAt ? formatDateTime(poll.closesAt, lang) : t('scheduleManual')}
        {poll.closedAt && (
          <>
            <br />
            {t('mClosedAt')}: {formatDateTime(poll.closedAt, lang)}
          </>
        )}
      </p>

      {poll.purgeAt && (
        <p className={daysLeft !== null && daysLeft <= WARN_DAYS ? 'notice warn' : 'hint'} role={daysLeft !== null && daysLeft <= WARN_DAYS ? 'status' : undefined}>
          {t('mPurgeAt')}: {formatDateTime(poll.purgeAt, lang)} ({retentionDays} {t('mDaysRetention')}).{' '}
          {daysLeft !== null && daysLeft <= WARN_DAYS && t('mPurgeSoon')}
        </p>
      )}

      <CopyField id={`m-url-${poll.id}`} label={t('voteLink')} value={poll.voteUrl} />
      <details className="mqr">
        <summary>{t('dashQrHeading')}</summary>
        <QrBlock slug={poll.slug} voteUrl={poll.voteUrl} />
      </details>

      {poll.status === 'open' && <p className="notice">{t('mRunningLocked')}</p>}

      {info && (
        <p role="status" className="notice">
          {t(info)}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}

      {issued && (
        <div className="notice warn" role="status">
          <p>{issued.kind === 'copy' ? t('mCopyDone') : t('mTokenDone')}</p>
          {issued.voteUrl && <CopyField id={`m-new-vote-${poll.id}`} label={t('voteLink')} value={issued.voteUrl} />}
          <CopyField id={`m-new-org-${poll.id}`} label={t('organizerLink')} value={issued.organizerUrl} />
          <p>{t('organizerWarn')}</p>
          <button type="button" className="button" onClick={() => setIssued(null)}>
            {t('mDismiss')}
          </button>
        </div>
      )}

      {mode === 'edit' && poll.status === 'upcoming' && (
        <MasterEdit
          code={code}
          poll={poll}
          onSaved={() => {
            setMode('none');
            setInfo('mSaved');
            void reload();
          }}
          onCancel={() => setMode('none')}
        />
      )}

      {mode === 'copy' && (
        <form
          className="section edit-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void doCopy();
          }}
          noValidate
          aria-labelledby={`copy-h-${poll.id}`}
        >
          <h4 id={`copy-h-${poll.id}`}>{t('mCopyTitle')}</h4>
          <p className="hint">{t('mCopyHint')}</p>
          <ScheduleFields opens={copyOpens} closes={copyCloses} setOpens={setCopyOpens} setCloses={setCopyCloses} idPrefix={`m-copy-${poll.id}`} />
          <div className="row">
            <button type="submit" className="button primary" disabled={busy}>
              {t('mCopyCreate')}
            </button>
            <button type="button" className="button" onClick={() => setMode('none')}>
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {mode === 'close' && confirm('closeConfirm', () => void run('poll.status', { to: 'close' }).then((ok) => ok && setMode('none')), 'closeYes')}
      {mode === 'delete' && confirm('mDeleteConfirm', () => void run('poll.delete', {}).then(() => setMode('none')), 'mDeleteYes')}
      {mode === 'token' && confirm('mTokenConfirm', () => void doToken(), 'mTokenYes')}

      <div className="field">
        <label htmlFor={`m-proj-${poll.id}`}>{t('mProject')}</label>
        <select
          id={`m-proj-${poll.id}`}
          value={poll.projectId ?? ''}
          disabled={busy}
          onChange={(e) => void run('poll.meta', { projectId: e.target.value || null }, 'mSaved')}
        >
          <option value="">{t('mNoProject')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row mactions" role="group" aria-label={t('mActions')}>
        {poll.status === 'upcoming' && (
          <button type="button" className="button" onClick={() => setMode(mode === 'edit' ? 'none' : 'edit')} aria-expanded={mode === 'edit'}>
            {t('mEdit')}
          </button>
        )}
        {poll.status === 'open' && (
          <button type="button" className="button" onClick={() => setMode('close')}>
            {t('closePoll')}
          </button>
        )}
        {poll.status === 'closed' && (
          <button type="button" className="button" disabled={busy} onClick={() => void run('poll.status', { to: 'open' }, 'mReopened')}>
            {t('reopenPoll')}
          </button>
        )}
        <button type="button" className="button" onClick={() => setMode(mode === 'copy' ? 'none' : 'copy')} aria-expanded={mode === 'copy'}>
          {t('mCopy')}
        </button>
        <button type="button" className="button" onClick={() => setMode('token')}>
          {t('mNewToken')}
        </button>
        <button type="button" className="button" disabled={busy} onClick={() => void run('poll.meta', { archived: !poll.archivedAt }, 'mSaved')}>
          {poll.archivedAt ? t('mUnarchive') : t('mArchive')}
        </button>
        <button type="button" className="button" onClick={() => exportPolls(poll.slug, [poll], projects, lang, t)}>
          {t('mExportCsv')}
        </button>
        {poll.status !== 'open' && (
          <button type="button" className="button danger" onClick={() => setMode('delete')}>
            {t('mDelete')}
          </button>
        )}
      </div>
    </div>
  );
}
