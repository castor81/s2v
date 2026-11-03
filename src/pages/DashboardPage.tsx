import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { pick, useLang, type Localized, type MessageKey } from '../i18n';
import { post } from '../lib/api';
import { rankOptions } from '../lib/ranking';
import { formatDateTime } from '../lib/time';
import { QrBlock } from '../components/QrBlock';
import { CopyField } from '../components/CopyField';
import { EditPanel } from '../components/EditPanel';

type Status = 'upcoming' | 'open' | 'closed';

interface Results {
  slug: string;
  voteUrl: string;
  title: Localized;
  options: { id: string; hu?: string; en?: string }[];
  status: Status;
  opensAt: string | null;
  closesAt: string | null;
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

const REFRESH_MS = 3000;
const MOVE_MS = 500;

export function DashboardPage() {
  const { token = '' } = useParams();
  const { t, lang } = useLang();
  const [data, setData] = useState<Results | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const statusRef = useRef<Status | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const prevTops = useRef(new Map<string, number>());

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
    // Nyitott vagy induló szavazásnál és látható lapnál frissítünk (kvóta- és akkumulátor-kímélés).
    // A még nem induló szavazás is frissül, hogy a nyitás pillanatában az állapot átforduljon.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && statusRef.current !== 'closed') void load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Élő átrendeződés (FLIP): a sorok a régi helyükről csúsznak az újra; csökkentett mozgás beállításnál nincs animáció.
  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const next = new Map<string, number>();
    rowRefs.current.forEach((el, id) => {
      const top = el.offsetTop;
      next.set(id, top);
      const before = prevTops.current.get(id);
      if (reduce || before === undefined || before === top) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${before - top}px)`;
      void el.offsetHeight; // kényszerített újraszámolás: a kezdőállapot rögzül
      el.style.transition = `transform ${MOVE_MS}ms ease`;
      el.style.transform = '';
    });
    prevTops.current = next;
  }, [data]);

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
  const ranked = rankOptions(data.options, stats.counts);
  const leader = stats.votes > 0 ? ranked[0] : undefined;
  const leaderText = leader ? `${t('leaderAnnounce')} ${pick(leader.item, lang)}` : '';

  return (
    <>
      <h1>{title}</h1>
      <p>
        {t('statusLabel')}: <span className={`badge ${data.status}`}>{t(STATUS_KEY[data.status])}</span>
      </p>
      {(data.opensAt || data.closesAt) && (
        <p className="schedule">
          {data.opensAt && (
            <>
              {t('scheduleOpens')}: {formatDateTime(data.opensAt, lang)}
              <br />
            </>
          )}
          {data.closesAt && (
            <>
              {t('scheduleCloses')}: {formatDateTime(data.closesAt, lang)}
            </>
          )}
        </p>
      )}

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
          <div className="row">
            <button type="button" className="button" onClick={() => setConfirmClose(true)}>
              {t('closePoll')}
            </button>
            {!editing && (
              <button type="button" className="button" onClick={() => setEditing(true)}>
                {data.status === 'upcoming' ? t('editBtn') : t('editClosesBtn')}
              </button>
            )}
          </div>
        )}
        {statusError && (
          <p role="alert" className="error">
            {t('statusChangeError')}
          </p>
        )}
      </div>

      {editing && data.status !== 'closed' && (
        <EditPanel
          token={token}
          status={data.status}
          title={data.title}
          options={data.options}
          opensAt={data.opensAt}
          closesAt={data.closesAt}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

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

      {/* Képernyőolvasónak: csak az élen álló változásakor szól (nem minden szavazatnál) */}
      <p className="sr-only" role="status" aria-live="polite">
        {leaderText}
      </p>

      <table className="results">
        <caption>{t('resultsHeading')}</caption>
        <thead>
          <tr>
            <th scope="col" className="rank">
              {t('colRank')}
            </th>
            <th scope="col">{t('colOption')}</th>
            <th scope="col">{t('colVotes')}</th>
            <th scope="col">{t('colShare')}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map(({ item, count, rank }) => {
            const share = stats.votes > 0 ? count / stats.votes : 0;
            return (
              <tr
                key={item.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(item.id, el);
                  else rowRefs.current.delete(item.id);
                }}
              >
                <td className="num rank">{rank}.</td>
                <th scope="row">{pick(item, lang)}</th>
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
