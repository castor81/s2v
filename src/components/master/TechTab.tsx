import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang, type MessageKey } from '../../i18n';
import { formatDateTime, toIso } from '../../lib/time';
import { masterPost, type Overview, type TechError, type TechHit } from '../../lib/master';

interface Props {
  code: string;
  data: Overview;
}

const ENDPOINT_KEY: Record<string, MessageKey> = {
  vote: 'ep_vote',
  open: 'ep_open',
  live: 'ep_live',
  results: 'ep_results',
  update: 'ep_update',
  status: 'ep_status',
};
const OUTCOME_KEY: Record<string, MessageKey> = {
  ok: 'oc_ok',
  already_voted: 'oc_already_voted',
  not_open: 'oc_not_open',
  rate_limited: 'oc_rate_limited',
  server_error: 'oc_server_error',
  invalid_request: 'oc_invalid_request',
  invalid_option: 'oc_invalid_option',
  not_found: 'oc_not_found',
  vote_first: 'oc_vote_first',
};

type Kind = 'ok' | 'rejected' | 'limited' | 'server';
const kindOf = (outcome: string): Kind =>
  outcome === 'ok' ? 'ok' : outcome === 'rate_limited' ? 'limited' : outcome === 'server_error' || /^http_5/.test(outcome) ? 'server' : 'rejected';

interface Sum {
  calls: number;
  ok: number;
  rejected: number;
  limited: number;
  server: number;
  msSum: number;
  msMax: number;
  first: string;
  last: string;
  peak: number;
  rows: Array<{ endpoint: string; outcome: string; n: number; msSum: number; msMax: number }>;
}

function summarize(hits: TechHit[]): Sum {
  const s: Sum = { calls: 0, ok: 0, rejected: 0, limited: 0, server: 0, msSum: 0, msMax: 0, first: '', last: '', peak: 0, rows: [] };
  const perMinute = new Map<string, number>();
  const rows = new Map<string, Sum['rows'][number]>();
  for (const h of hits) {
    s.calls += h.n;
    s[kindOf(h.outcome)] += h.n;
    s.msSum += h.msSum;
    s.msMax = Math.max(s.msMax, h.msMax);
    if (!s.first || h.bucket < s.first) s.first = h.bucket;
    if (!s.last || h.bucket > s.last) s.last = h.bucket;
    perMinute.set(h.bucket, (perMinute.get(h.bucket) ?? 0) + h.n);
    const k = `${h.endpoint}|${h.outcome}`;
    const r = rows.get(k) ?? { endpoint: h.endpoint, outcome: h.outcome, n: 0, msSum: 0, msMax: 0 };
    r.n += h.n;
    r.msSum += h.msSum;
    r.msMax = Math.max(r.msMax, h.msMax);
    rows.set(k, r);
  }
  s.peak = Math.max(0, ...perMinute.values());
  s.rows = [...rows.values()].sort((a, b) => a.endpoint.localeCompare(b.endpoint) || b.n - a.n);
  return s;
}

export function TechTab({ code, data }: Props) {
  const { t, lang } = useLang();
  const [hits, setHits] = useState<TechHit[]>([]);
  const [errors, setErrors] = useState<TechError[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [project, setProject] = useState('');
  const [poll, setPoll] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await masterPost<{ hits: TechHit[]; errors: TechError[]; hitsTruncated: boolean; errorsTruncated: boolean }>(code, 'tech.list', { from: toIso(from), to: toIso(to) });
    setLoading(false);
    if (r.ok) {
      const d = r.data as { hits: TechHit[]; errors: TechError[]; hitsTruncated: boolean; errorsTruncated: boolean };
      setHits(d.hits);
      setErrors(d.errors);
      setTruncated(d.hitsTruncated || d.errorsTruncated);
      setFailed(false);
    } else setFailed(true);
  }, [code, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  // A szavazások nevei és projektjei az áttekintésből (a már törölt szavazások csak slug-gal látszanak).
  const bySlug = useMemo(() => new Map(data.polls.map((p) => [p.slug, p])), [data.polls]);
  const label = (slug: string | null) => {
    if (!slug) return t('tcUnknownPoll');
    const p = bySlug.get(slug);
    return p ? `${p.title.hu ?? p.title.en ?? '—'} (${slug})` : slug;
  };

  const slugs = useMemo(() => [...new Set(hits.map((h) => h.pollSlug ?? ''))], [hits]);
  const pollOptions = useMemo(() => slugs.filter(Boolean).map((s) => [s, label(s)] as const).sort((a, b) => a[1].localeCompare(b[1], lang)), [slugs, bySlug, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleHits = useMemo(
    () =>
      hits.filter((h) => {
        if (poll && (h.pollSlug ?? '') !== poll) return false;
        if (project) {
          const p = h.pollSlug ? bySlug.get(h.pollSlug) : undefined;
          if ((p?.projectId ?? '') !== project) return false;
        }
        if (onlyProblems && h.outcome === 'ok') return false;
        return true;
      }),
    [hits, poll, project, onlyProblems, bySlug],
  );
  const visibleErrors = useMemo(
    () =>
      errors.filter((e) => {
        if (poll && (e.pollSlug ?? '') !== poll) return false;
        if (project) {
          const p = e.pollSlug ? bySlug.get(e.pollSlug) : undefined;
          if ((p?.projectId ?? '') !== project) return false;
        }
        return true;
      }),
    [errors, poll, project, bySlug],
  );

  const total = useMemo(() => summarize(visibleHits), [visibleHits]);
  const perPoll = useMemo(() => {
    const m = new Map<string, TechHit[]>();
    for (const h of visibleHits) m.set(h.pollSlug ?? '', [...(m.get(h.pollSlug ?? '') ?? []), h]);
    return [...m.entries()]
      .map(([slug, hs]) => ({ slug, sum: summarize(hs) }))
      .sort((a, b) => (a.sum.last < b.sum.last ? 1 : -1));
  }, [visibleHits]);

  const avg = (s: { msSum: number; calls?: number; n?: number }) => {
    const n = s.calls ?? s.n ?? 0;
    return n ? Math.round(s.msSum / n) : 0;
  };
  const ms = (v: number) => `${v} ${t('tcMs')}`;
  const stat = (k: MessageKey, v: string | number, warn = false) => (
    <div className={`stat${warn ? ' warn' : ''}`}>
      <dt>{t(k)}</dt>
      <dd>{v}</dd>
    </div>
  );

  return (
    <>
      <p className="hint">{t('tcHelp')}</p>
      <p className="hint">{t('tcApprox')}</p>

      <div className="audit-filters" role="search">
        <div className="field">
          <label htmlFor="tc-project">{t('auProject')}</label>
          <select id="tc-project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">{t('auAllProjects')}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tc-poll">{t('auPoll')}</label>
          <select id="tc-poll" value={poll} onChange={(e) => setPoll(e.target.value)}>
            <option value="">{t('auAllPolls')}</option>
            {pollOptions.map(([s, l]) => (
              <option key={s} value={s}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tc-from">{t('auFromTime')}</label>
          <input id="tc-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tc-to">{t('auToTime')}</label>
          <input id="tc-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <label className="inline-check">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> {t('tcOnlyProblems')}
        </label>
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? t('loading') : t('auRefresh')}
        </button>
      </div>

      {failed && (
        <p role="alert" className="error">
          {t('auLoadError')}
        </p>
      )}
      {truncated && <p className="notice warn">{t('tcTruncated')}</p>}

      <dl className="stats">
        {stat('tcCalls', total.calls)}
        {stat('tcOk', total.ok)}
        {stat('tcRejected', total.rejected)}
        {stat('tcLimited', total.limited, total.limited > 0)}
        {stat('tcServer', total.server, total.server > 0)}
        {stat('tcAvg', ms(avg(total)))}
        {stat('tcMax', ms(total.msMax))}
        {stat('tcPeak', total.peak)}
      </dl>

      {!loading && !failed && perPoll.length === 0 ? (
        <p>{t('tcNone')}</p>
      ) : (
        <ul className="mlist">
          {perPoll.map(({ slug, sum }) => {
            const pollErrors = errors.filter((e) => (e.pollSlug ?? '') === slug);
            return (
              <li key={slug || 'unknown'} className="mpoll">
                <div className="mhead">
                  <h3>{label(slug || null)}</h3>
                  {sum.server > 0 && <span className="badge closed">{t('tcServer')}: {sum.server}</span>}
                </div>
                <p className="mmeta">
                  {t('tcPeriod')}: {formatDateTime(sum.first, lang)} – {formatDateTime(sum.last, lang)}
                  <br />
                  {t('tcCalls')}: {sum.calls} · {t('tcOk')}: {sum.ok} · {t('tcRejected')}: {sum.rejected} · {t('tcLimited')}: {sum.limited} · {t('tcServer')}: {sum.server}
                  <br />
                  {t('tcAvg')}: {ms(avg(sum))} · {t('tcMax')}: {ms(sum.msMax)} · {t('tcPeak')}: {sum.peak}
                </p>
                <details>
                  <summary>{t('tcBreakdown')}</summary>
                  <table className="results">
                    <thead>
                      <tr>
                        <th scope="col">{t('tcEndpoint')}</th>
                        <th scope="col">{t('tcOutcome')}</th>
                        <th scope="col">{t('tcCalls')}</th>
                        <th scope="col">{t('tcAvg')}</th>
                        <th scope="col">{t('tcMax')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sum.rows.map((r) => (
                        <tr key={`${r.endpoint}|${r.outcome}`}>
                          <td>{ENDPOINT_KEY[r.endpoint] ? t(ENDPOINT_KEY[r.endpoint]) : r.endpoint}</td>
                          <td>{OUTCOME_KEY[r.outcome] ? t(OUTCOME_KEY[r.outcome]) : r.outcome}</td>
                          <td>{r.n}</td>
                          <td>{ms(avg(r))}</td>
                          <td>{ms(r.msMax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pollErrors.length > 0 && (
                    <p className="hint">
                      {t('tcErrorsTitle')}: {pollErrors.length}
                    </p>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <h3>{t('tcErrorsTitle')}</h3>
      {visibleErrors.length === 0 ? (
        <p>{t('tcNoErrors')}</p>
      ) : (
        <ol className="audit-list">
          {visibleErrors.slice(0, 100).map((e) => (
            <li key={e.id} className="mpoll">
              <div className="mhead">
                <strong>
                  {ENDPOINT_KEY[e.endpoint] ? t(ENDPOINT_KEY[e.endpoint]) : e.endpoint} · {e.status}
                </strong>
                <span className="badge closed">{e.error ?? '—'}</span>
              </div>
              <p className="mmeta">
                {formatDateTime(e.at, lang)} · {label(e.pollSlug)}
                {e.message && (
                  <>
                    <br />
                    <code>{e.message}</code>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
