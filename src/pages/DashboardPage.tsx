import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { pick, useLang, type Localized, type MessageKey } from '../i18n';
import { post } from '../lib/api';
import { QrBlock } from '../components/QrBlock';
import { CopyField } from '../components/CopyField';

type Status = 'upcoming' | 'open' | 'closed';

interface Results {
  slug: string;
  voteUrl: string;
  title: Localized;
  options: { id: string; hu?: string; en?: string }[];
  status: Status;
  stats: {
    sessions: number;
    votes: number;
    completionRate: number | null;
    medianSecondsToVote: number | null;
    counts: Record<string, number>;
  };
}

const STATUS_KEY: Record<Status, MessageKey> = {
  open: 'statusOpen',
  closed: 'statusClosed',
  upcoming: 'statusUpcoming',
};

const REFRESH_MS = 5000;

export function DashboardPage() {
  const { token = '' } = useParams();
  const { t, lang } = useLang();
  const [data, setData] = useState<Results | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const statusRef = useRef<Status | null>(null);

  // A szervezői hivatkozás titkot tartalmaz: keresők ne indexeljék.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  const load = useCallback(async () => {
    const r = await post<Results>('/api/results', { token });
    if (r.ok) {
      const d = r.data as Results;
      statusRef.current = d.status;
      setData(d);
      setLoadError(false);
      setUpdated(new Date());
    } else if (r.status === 404 || r.status === 400) {
      setNotFound(true);
    } else {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
    // Csak nyitott szavazásnál és látható lapnál frissítünk (kvóta- és akkumulátor-kímélés).
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && statusRef.current !== 'closed') void load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function changeStatus(action: 'open' | 'close') {
    setBusy(true);
    setStatusError(false);
    const r = await post<{ status: Status }>('/api/status', { token, action });
    setBusy(false);
    setConfirmClose(false);
    if (r.ok) await load();
    else setStatusError(true);
  }

  if (notFound) {
    return (
      <>
        <h1>{t('dashNotFoundTitle')}</h1>
        <p>{t('dashNotFoundText')}</p>
      </>
    );
  }
  if (!data) {
    return (
      <>
        {loadError ? (
          <p role="alert" className="error">
            {t('dashError')}
          </p>
        ) : (
          <p>{t('loading')}</p>
        )}
      </>
    );
  }

  const nf = new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', { maximumFractionDigits: 1 });
  const pct = (n: number) => `${nf.format(n * 100)} %`;
  const { stats } = data;
  const title = pick(data.title, lang);

  return (
    <>
      <h1>{title}</h1>
      <p>
        {t('statusLabel')}: <span className={`badge ${data.status}`}>{t(STATUS_KEY[data.status])}</span>
      </p>

      <div className="section">
        {data.status === 'closed' ? (
          <button type="button" className="button" disabled={busy} onClick={() => void changeStatus('open')}>
            {t('reopenPoll')}
          </button>
        ) : confirmClose ? (
          <div role="alertdialog" aria-labelledby="close-q" className="notice warn">
            <p id="close-q">{t('closeConfirm')}</p>
            <div className="row">
              <button type="button" className="button primary" disabled={busy} onClick={() => void changeStatus('close')}>
                {t('closeYes')}
              </button>
              <button type="button" className="button" onClick={() => setConfirmClose(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button" onClick={() => setConfirmClose(true)}>
            {t('closePoll')}
          </button>
        )}
        {statusError && (
          <p role="alert" className="error">
            {t('statusChangeError')}
          </p>
        )}
      </div>

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
          <dd>{stats.completionRate === null ? t('noData') : pct(stats.completionRate)}</dd>
        </div>
        <div className="stat">
          <dt>{t('statMedian')}</dt>
          <dd>
            {stats.medianSecondsToVote === null
              ? t('noData')
              : `${nf.format(stats.medianSecondsToVote)} ${t('secondsShort')}`}
          </dd>
        </div>
      </dl>

      <table className="results">
        <caption>{t('resultsHeading')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('colOption')}</th>
            <th scope="col">{t('colVotes')}</th>
            <th scope="col">{t('colShare')}</th>
          </tr>
        </thead>
        <tbody>
          {data.options.map((o) => {
            const count = stats.counts[o.id] ?? 0;
            const share = stats.votes > 0 ? count / stats.votes : 0;
            return (
              <tr key={o.id}>
                <th scope="row">{pick(o, lang)}</th>
                <td className="num">{count}</td>
                <td>
                  <div className="num">{pct(share)}</div>
                  {/* A sáv csak szemléltet; az érték számként és szövegként is szerepel */}
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${share * 100}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {stats.votes === 0 && <p>{t('noVotesYet')}</p>}

      <p className="hint">
        {t('autoRefresh')}
        {updated && ` ${t('updatedAt')}: ${updated.toLocaleTimeString(lang === 'hu' ? 'hu-HU' : 'en-GB')}.`}
      </p>
      <button type="button" className="button" onClick={() => void load()}>
        {t('refreshNow')}
      </button>
      {loadError && (
        <p role="alert" className="error">
          {t('dashError')}
        </p>
      )}

      <section className="section" aria-labelledby="qr-h">
        <h2 id="qr-h">{t('dashQrHeading')}</h2>
        <QrBlock slug={data.slug} voteUrl={data.voteUrl} />
        <CopyField id="dash-vote-url" label={t('voteLink')} value={data.voteUrl} />
      </section>
    </>
  );
}
