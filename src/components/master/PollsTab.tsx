import { useEffect, useMemo, useState } from 'react';
import { pick, useLang, type MessageKey } from '../../i18n';
import { formatDateTime } from '../../lib/time';
import { exportPolls } from '../../lib/csv';
import { rankOptions } from '../../lib/ranking';
import { masterError, masterPost, type Overview, type PollStatus } from '../../lib/master';
import { PollDetail } from './PollDetail';

interface Props {
  code: string;
  data: Overview;
  reload: () => Promise<void>;
}

const STATUS_KEY: Record<PollStatus, MessageKey> = { open: 'statusOpen', closed: 'statusClosed', upcoming: 'statusUpcoming' };
type Sort = 'created' | 'opens' | 'votes' | 'title';
const ORDER: PollStatus[] = ['open', 'upcoming', 'closed'];

export function PollsTab({ code, data, reload }: Props) {
  const { t, lang } = useLang();
  const [status, setStatus] = useState<'all' | PollStatus>('all');
  const [project, setProject] = useState('all'); // all | none | <id>
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('created');
  const [archived, setArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Törlés a listából: kijelölés (több szavazás egyszerre) és megerősítés
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const projectName = useMemo(() => new Map(data.projects.map((p) => [p.id, p.name])), [data.projects]);
  const nf = new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-GB');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.polls.filter((p) => {
      if (!archived && p.archivedAt) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (project === 'none' ? p.projectId !== null : project !== 'all' && p.projectId !== project) return false;
      if (q) {
        const hay = `${p.title.hu ?? ''} ${p.title.en ?? ''} ${p.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);
    list.sort((a, b) => {
      if (sort === 'votes') return b.stats.votes - a.stats.votes;
      if (sort === 'title') return pick(a.title, lang).localeCompare(pick(b.title, lang), lang);
      if (sort === 'opens') return time(a.opensAt ?? a.createdAt) - time(b.opensAt ?? b.createdAt);
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    return list;
  }, [data.polls, status, project, query, sort, archived, lang]);

  // A már megszűnt (vagy futóvá vált) szavazások kikerülnek a kijelölésből.
  useEffect(() => {
    setSelected((prev) => {
      const keep = new Set(data.polls.filter((p) => p.status !== 'open' && prev.has(p.id)).map((p) => p.id));
      return keep.size === prev.size ? prev : keep;
    });
  }, [data.polls]);

  const deletable = visible.filter((p) => p.status !== 'open');
  const allSelected = deletable.length > 0 && deletable.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteIds(ids: string[]) {
    setBusy(true);
    setMessage(null);
    let failed = 0;
    let running = 0;
    for (const id of ids) {
      const r = await masterPost(code, 'poll.delete', { id });
      if (!r.ok) {
        failed += 1;
        if (masterError(r) === 'mErrRunning') running += 1;
      }
    }
    setBusy(false);
    setConfirmIds(null);
    setSelected(new Set());
    if (openId && ids.includes(openId)) setOpenId(null);
    const done = ids.length - failed;
    setMessage(
      failed === 0
        ? { kind: 'ok', text: `${done} ${t('mDeletedN')}` }
        : { kind: 'error', text: `${done} ${t('mDeletedN')}, ${failed} ${t('mDeleteFailedN')}${running ? ` (${t('mErrRunning')})` : ''}` },
    );
    await reload();
  }

  const confirmBox = (ids: string[]) => (
    <div role="alertdialog" aria-label={t('mDeleteConfirm')} className="notice warn">
      <p>
        {ids.length > 1 ? `${ids.length} ${t('mBulkDeleteConfirm')}` : t('mDeleteConfirm')}
      </p>
      <div className="row">
        <button type="button" className="button primary" disabled={busy} onClick={() => void deleteIds(ids)}>
          {busy ? t('saving') : t('mDeleteYes')}
        </button>
        <button type="button" className="button" disabled={busy} onClick={() => setConfirmIds(null)}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );

  const active = data.polls.filter((p) => !p.archivedAt);
  const count = (s: PollStatus) => active.filter((p) => p.status === s).length;
  const totalVotes = active.reduce((n, p) => n + p.stats.votes, 0);

  return (
    <>
      <dl className="stats">
        <div className="stat">
          <dt>{t('mTileRunning')}</dt>
          <dd>{count('open')}</dd>
        </div>
        <div className="stat">
          <dt>{t('mTileUpcoming')}</dt>
          <dd>{count('upcoming')}</dd>
        </div>
        <div className="stat">
          <dt>{t('mTileClosed')}</dt>
          <dd>{count('closed')}</dd>
        </div>
        <div className="stat">
          <dt>{t('mTileVotes')}</dt>
          <dd>{nf.format(totalVotes)}</dd>
        </div>
      </dl>

      <form className="mfilters" role="search" aria-label={t('mFilters')} onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="m-q">{t('mSearch')}</label>
          <input id="m-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="m-status">{t('statusLabel')}</label>
          <select id="m-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">{t('mAll')}</option>
            {ORDER.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_KEY[s])}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-project">{t('mProject')}</label>
          <select id="m-project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">{t('mAll')}</option>
            <option value="none">{t('mNoProject')}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-sort">{t('mSort')}</label>
          <select id="m-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="created">{t('mSortCreated')}</option>
            <option value="opens">{t('mSortOpens')}</option>
            <option value="votes">{t('mSortVotes')}</option>
            <option value="title">{t('mSortTitle')}</option>
          </select>
        </div>
        <label className="mcheck">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          <span>{t('mShowArchived')}</span>
        </label>
      </form>

      <div className="row">
        <button type="button" className="button" disabled={visible.length === 0} onClick={() => exportPolls('szavazasok', visible, data.projects, lang, t)}>
          {t('mExportList')}
        </button>
        <span className="hint" role="status">
          {visible.length} / {data.polls.length} {t('mPollsShown')}
        </span>
      </div>

      {deletable.length > 0 && (
        <div className="row mbulk">
          <label className="mcheck">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(deletable.map((p) => p.id)))}
            />
            <span>{t('mSelectAllVisible')}</span>
          </label>
          {selected.size > 0 && (
            <>
              <span role="status">
                {selected.size} {t('mSelectedCount')}
              </span>
              <button type="button" className="button danger" onClick={() => setConfirmIds([...selected])}>
                {t('mDeleteSelected')}
              </button>
              <button type="button" className="button" onClick={() => setSelected(new Set())}>
                {t('mClearSelection')}
              </button>
            </>
          )}
        </div>
      )}
      {confirmIds && confirmIds.length > 1 && confirmBox(confirmIds)}
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'error' : 'notice'}>
          {message.text}
        </p>
      )}

      {visible.length === 0 ? (
        <p>{t('mNoPolls')}</p>
      ) : (
        <ul className="mlist">
          {visible.map((p) => {
            const open = openId === p.id;
            const leader = p.stats.votes > 0 ? rankOptions(p.options, p.stats.counts)[0] : undefined;
            return (
              <li key={p.id} className={`mpoll ${p.status}`}>
                <div className="mhead">
                  {p.status !== 'open' && (
                    <input
                      type="checkbox"
                      className="mselect"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`${t('mSelectPoll')}: ${pick(p.title, lang)}`}
                    />
                  )}
                  <h3>{pick(p.title, lang)}</h3>
                  <span className={`badge ${p.status}`}>{t(STATUS_KEY[p.status])}</span>
                  {p.archivedAt && <span className="badge archived">{t('mArchived')}</span>}
                </div>
                <p className="mmeta">
                  {p.projectId ? projectName.get(p.projectId) : t('mNoProject')} · {nf.format(p.stats.votes)} {t('mVotesShort')}
                  {leader && ` · ${t('leaderAnnounce')} ${pick(leader.item, lang)}`}
                  <br />
                  {p.status === 'upcoming' && p.opensAt && `${t('scheduleOpens')}: ${formatDateTime(p.opensAt, lang)}`}
                  {p.status === 'open' && (p.closesAt ? `${t('scheduleCloses')}: ${formatDateTime(p.closesAt, lang)}` : t('mManualClose'))}
                  {p.status === 'closed' && `${t('mClosedAt')}: ${formatDateTime(p.closedAt ?? p.closesAt ?? p.createdAt, lang)}`}
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="button"
                    aria-expanded={open}
                    aria-controls={`m-detail-${p.id}`}
                    onClick={() => setOpenId(open ? null : p.id)}
                  >
                    {open ? t('mHideDetails') : t('mShowDetails')}
                  </button>
                  {p.status !== 'open' && (
                    <button
                      type="button"
                      className="button danger"
                      aria-label={`${t('mDelete')}: ${pick(p.title, lang)}`}
                      onClick={() => setConfirmIds([p.id])}
                    >
                      {t('mDelete')}
                    </button>
                  )}
                </div>
                {confirmIds && confirmIds.length === 1 && confirmIds[0] === p.id && confirmBox(confirmIds)}
                {open && (
                  <div id={`m-detail-${p.id}`}>
                    <PollDetail
                      code={code}
                      poll={p}
                      projects={data.projects}
                      codes={data.codes}
                      retentionDays={data.retentionDays}
                      now={data.now}
                      reload={reload}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
