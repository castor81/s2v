import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang, type MessageKey } from '../../i18n';
import { formatDateTime, toIso } from '../../lib/time';
import { masterPost, type AuditEntry } from '../../lib/master';

interface Props {
  code: string;
}

const PAGE = 200;

const ACTION_KEY: Record<string, MessageKey> = {
  signin: 'auA_signin',
  'poll.create': 'auA_poll_create',
  'poll.update': 'auA_poll_update',
  'poll.close': 'auA_poll_close',
  'poll.reopen': 'auA_poll_reopen',
  'poll.move': 'auA_poll_move',
  'poll.archive': 'auA_poll_archive',
  'poll.unarchive': 'auA_poll_unarchive',
  'poll.delete': 'auA_poll_delete',
  'poll.copy': 'auA_poll_copy',
  'poll.newToken': 'auA_poll_newToken',
  'project.create': 'auA_project_create',
  'project.rename': 'auA_project_rename',
  'project.delete': 'auA_project_delete',
  'code.create': 'auA_code_create',
  'code.update': 'auA_code_update',
  'code.enable': 'auA_code_enable',
  'code.disable': 'auA_code_disable',
  'code.delete': 'auA_code_delete',
};

const FIELD_KEY: Record<string, MessageKey> = {
  title: 'auFTitle',
  options: 'auFOptions',
  opensAt: 'auFOpens',
  opens_at: 'auFOpens',
  closesAt: 'auFCloses',
  closes_at: 'auFCloses',
  label: 'auFLabel',
  projectId: 'auFProject',
  expiresAt: 'auFExpires',
};

const ROLE_KEY: Record<AuditEntry['actorRole'], MessageKey> = {
  master: 'auRoleMaster',
  director: 'auRoleDirector',
  editor: 'auRoleEditor',
  organizer: 'auRoleOrganizer',
};

/** A szűréshez használt szereplő-kulcs: master / direktor / szerkesztői kód (a szervezői link a kódjához tartozik). */
function whoKey(e: AuditEntry): string {
  if (e.actorRole === 'master' || e.actorRole === 'director') return e.actorRole;
  return `code:${e.codeId ?? 'general'}`;
}

export function AuditTab({ code }: Props) {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [who, setWho] = useState('');
  const [project, setProject] = useState('');
  const [poll, setPoll] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await masterPost<{ entries: AuditEntry[]; truncated: boolean }>(code, 'audit.list', { from: toIso(from), to: toIso(to) });
    setLoading(false);
    if (r.ok) {
      const d = r.data as { entries: AuditEntry[]; truncated: boolean };
      setEntries(d.entries);
      setTruncated(d.truncated);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, [code, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const whoText = useCallback(
    (e: AuditEntry) => {
      if (e.actorRole === 'master' || e.actorRole === 'director') return t(ROLE_KEY[e.actorRole]);
      const name = e.actorLabel && e.actorLabel !== 'general' ? e.actorLabel : t('auGeneralCode');
      return `${name} (${t(ROLE_KEY[e.actorRole])})`;
    },
    [t],
  );

  // A szűrők választékát a napló tartalmából építjük (a már törölt elemek is kereshetők maradnak).
  const options = useMemo(() => {
    const whos = new Map<string, string>();
    const projects = new Map<string, string>();
    const polls = new Map<string, string>();
    const actions = new Set<string>();
    for (const e of entries) {
      const wk = whoKey(e);
      if (!whos.has(wk)) whos.set(wk, wk === 'master' ? t('auRoleMaster') : wk === 'director' ? t('auRoleDirector') : e.actorLabel && e.actorLabel !== 'general' ? e.actorLabel : t('auGeneralCode'));
      if (e.projectId || e.projectName) {
        const k = e.projectId ?? `n:${e.projectName}`;
        if (!projects.has(k) && e.projectName) projects.set(k, e.projectName);
      }
      if (e.pollId || e.pollSlug) {
        const k = e.pollId ?? `s:${e.pollSlug}`;
        if (!polls.has(k)) polls.set(k, `${e.pollTitle ?? '—'} (${e.pollSlug ?? ''})`);
      }
      actions.add(e.action);
    }
    const byLabel = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1], lang === 'hu' ? 'hu' : 'en');
    return { whos: [...whos].sort(byLabel), projects: [...projects].sort(byLabel), polls: [...polls].sort(byLabel), actions: [...actions] };
  }, [entries, t, lang]);

  const subject = useCallback(
    (e: AuditEntry): string[] => {
      const out: string[] = [];
      if (e.pollSlug || e.pollTitle) out.push(`${t('auPoll')}: ${e.pollTitle ?? '—'}${e.pollSlug ? ` · ${e.pollSlug}` : ''}`);
      if (e.projectName) out.push(`${t('auProject')}: ${e.projectName}`);
      const d = e.detail ?? {};
      if (typeof d.code === 'string' && d.code) out.push(`${t('auCode')}: ${d.code}`);
      if (Array.isArray(d.fields)) out.push(`${t('auFields')}: ${(d.fields as string[]).map((f) => (FIELD_KEY[f] ? t(FIELD_KEY[f]) : f)).join(', ')}`);
      if (e.action === 'poll.move') out.push(`${t('auMovedFrom')}: ${typeof d.fromProject === 'string' && d.fromProject ? d.fromProject : t('auNoProject')}`);
      if (e.action === 'poll.copy' && typeof d.copiedFrom === 'string') out.push(`${t('auCopiedFrom')}: ${d.copiedFrom}`);
      if (e.action === 'project.rename' && typeof d.to === 'string') out.push(`${t('auRenamedTo')}: ${d.to}`);
      return out;
    },
    [t],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (who && whoKey(e) !== who) return false;
      if (project && (e.projectId ?? `n:${e.projectName}`) !== project) return false;
      if (poll && (e.pollId ?? `s:${e.pollSlug}`) !== poll) return false;
      if (action && e.action !== action) return false;
      if (needle) {
        const hay = `${whoText(e)} ${t(ACTION_KEY[e.action] ?? 'auA_signin')} ${subject(e).join(' ')} ${e.pollSlug ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [entries, who, project, poll, action, q, whoText, subject, t]);

  const anyFilter = Boolean(from || to || who || project || poll || action || q);
  const visible = filtered.slice(0, shown);
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString(lang === 'hu' ? 'hu-HU' : 'en-GB', { dateStyle: 'full' });

  return (
    <>
      <p className="hint">{t('auHelp')}</p>

      <div className="audit-filters" role="search">
        <div className="field">
          <label htmlFor="au-who">{t('auWho')}</label>
          <select id="au-who" value={who} onChange={(e) => (setWho(e.target.value), setShown(PAGE))}>
            <option value="">{t('auWhoAll')}</option>
            {options.whos.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="au-project">{t('auProject')}</label>
          <select id="au-project" value={project} onChange={(e) => (setProject(e.target.value), setShown(PAGE))}>
            <option value="">{t('auAllProjects')}</option>
            {options.projects.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="au-poll">{t('auPoll')}</label>
          <select id="au-poll" value={poll} onChange={(e) => (setPoll(e.target.value), setShown(PAGE))}>
            <option value="">{t('auAllPolls')}</option>
            {options.polls.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="au-action">{t('auAction')}</label>
          <select id="au-action" value={action} onChange={(e) => (setAction(e.target.value), setShown(PAGE))}>
            <option value="">{t('auAllActions')}</option>
            {options.actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_KEY[a] ? t(ACTION_KEY[a]) : a}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="au-from">{t('auFromTime')}</label>
          <input id="au-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="au-to">{t('auToTime')}</label>
          <input id="au-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="au-q">{t('auSearch')}</label>
          <input id="au-q" type="search" value={q} onChange={(e) => (setQ(e.target.value), setShown(PAGE))} />
        </div>
      </div>

      <div className="row">
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? t('loading') : t('auRefresh')}
        </button>
        {anyFilter && (
          <button
            type="button"
            className="button"
            onClick={() => {
              setFrom('');
              setTo('');
              setWho('');
              setProject('');
              setPoll('');
              setAction('');
              setQ('');
              setShown(PAGE);
            }}
          >
            {t('auReset')}
          </button>
        )}
        <span className="hint" role="status">
          {filtered.length} / {entries.length} {t('auEntries')}
        </span>
      </div>

      {failed && (
        <p role="alert" className="error">
          {t('auLoadError')}
        </p>
      )}
      {truncated && <p className="notice warn">{t('auTruncated')}</p>}

      {!loading && !failed && filtered.length === 0 ? (
        <p>{t('auNone')}</p>
      ) : (
        <ol className="audit-list">
          {visible.map((e, i) => {
            const newDay = i === 0 || dayKey(visible[i - 1].at) !== dayKey(e.at);
            return (
              <li key={e.id} className="audit-item">
                {newDay && <h3 className="audit-day">{dayKey(e.at)}</h3>}
                <div className="mpoll">
                  <div className="mhead">
                    <strong>{ACTION_KEY[e.action] ? t(ACTION_KEY[e.action]) : e.action}</strong>
                    <span className="badge closed">{whoText(e)}</span>
                  </div>
                  <p className="mmeta">
                    {formatDateTime(e.at, lang)}
                    {subject(e).map((s, k) => (
                      <span key={k}>
                        <br />
                        {s}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {filtered.length > shown && (
        <button type="button" className="button" onClick={() => setShown(shown + PAGE)}>
          {t('auMore')} ({filtered.length - shown})
        </button>
      )}
    </>
  );
}
