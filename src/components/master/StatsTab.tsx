import { pick, useLang } from '../../i18n';
import type { Overview } from '../../lib/master';

/** Összesítő statisztika a nem archivált szavazásokról: számlálók, legtöbb szavazat, projektek szerint. */
export function StatsTab({ data }: { data: Overview }) {
  const { t, lang } = useLang();
  const nf = new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', { maximumFractionDigits: 1 });
  const polls = data.polls.filter((p) => !p.archivedAt);
  const votes = polls.reduce((n, p) => n + p.stats.votes, 0);
  const withSessions = polls.filter((p) => p.stats.sessions > 0);
  const sessions = withSessions.reduce((n, p) => n + p.stats.sessions, 0);
  const completion = sessions > 0 ? `${nf.format((withSessions.reduce((n, p) => n + p.stats.votes, 0) / sessions) * 100)} %` : t('noData');
  const count = (s: string) => polls.filter((p) => p.status === s).length;

  const top = [...polls].sort((a, b) => b.stats.votes - a.stats.votes).filter((p) => p.stats.votes > 0).slice(0, 10);
  const max = top[0]?.stats.votes ?? 0;

  const rows = [...data.projects.map((pr) => ({ id: pr.id, name: pr.name })), { id: '', name: t('mNoProject') }].map((pr) => {
    const ps = polls.filter((p) => (p.projectId ?? '') === pr.id);
    return { ...pr, polls: ps.length, running: ps.filter((p) => p.status === 'open').length, votes: ps.reduce((n, p) => n + p.stats.votes, 0) };
  }).filter((r) => r.polls > 0);

  return (
    <>
      <h1>{t('navStats')}</h1>
      <dl className="stats">
        <div className="stat">
          <dt>{t('stPolls')}</dt>
          <dd>{polls.length}</dd>
        </div>
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
          <dd>{nf.format(votes)}</dd>
        </div>
        <div className="stat">
          <dt>{t('stAvgCompletion')}</dt>
          <dd>{completion}</dd>
        </div>
      </dl>

      <table className="results">
        <caption>{t('stTopPolls')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('stColPoll')}</th>
            <th scope="col">{t('colVotes')}</th>
          </tr>
        </thead>
        <tbody>
          {top.length === 0 ? (
            <tr>
              <td colSpan={2}>{t('noVotesYet')}</td>
            </tr>
          ) : (
            top.map((p) => (
              <tr key={p.id}>
                <th scope="row">{pick(p.title, lang)}</th>
                <td>
                  <div className="num">{nf.format(p.stats.votes)}</div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${max ? (p.stats.votes / max) * 100 : 0}%` }} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <table className="results">
        <caption>{t('stByProject')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('mProject')}</th>
            <th scope="col">{t('stColPolls')}</th>
            <th scope="col">{t('mRunningCount')}</th>
            <th scope="col">{t('colVotes')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id || 'none'}>
              <th scope="row">{r.name}</th>
              <td className="num">{r.polls}</td>
              <td className="num">{r.running}</td>
              <td className="num">{nf.format(r.votes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
