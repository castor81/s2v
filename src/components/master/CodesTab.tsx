import { useState, type FormEvent } from 'react';
import { useLang, type MessageKey } from '../../i18n';
import { formatDateTime, timeZoneName, toIso, toLocalInput } from '../../lib/time';
import { masterError, masterPost, type MCode, type Overview } from '../../lib/master';
import { CopyField } from '../CopyField';

interface Props {
  code: string;
  data: Overview;
  reload: () => Promise<void>;
}

function codeState(c: MCode, now: string): 'active' | 'disabled' | 'expired' {
  if (!c.active) return 'disabled';
  if (c.expiresAt && Date.parse(c.expiresAt) <= Date.parse(now)) return 'expired';
  return 'active';
}
const STATE_KEY: Record<'active' | 'disabled' | 'expired', MessageKey> = {
  active: 'mCodeActive',
  disabled: 'mCodeDisabled',
  expired: 'mCodeExpired',
};

export function CodesTab({ code, data, reload }: Props) {
  const { t, lang } = useLang();
  const [label, setLabel] = useState('');
  const [custom, setCustom] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');
  const [issued, setIssued] = useState<{ label: string; code: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editExpires, setEditExpires] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const tz = timeZoneName();

  async function run(action: string, extra: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const r = await masterPost<{ code?: string }>(code, action, extra);
    setBusy(false);
    if (!r.ok) {
      setError(masterError(r));
      return null;
    }
    await reload();
    return r.data as { code?: string };
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const d = await run('code.create', { label, code: custom.trim() || undefined, projectId: projectId || null, expiresAt: toIso(expires) });
    if (d?.code) {
      setIssued({ label, code: d.code });
      setLabel('');
      setCustom('');
      setProjectId('');
      setExpires('');
    }
  }

  const projectName = new Map(data.projects.map((p) => [p.id, p.name]));
  const pollsOf = (id: string) => data.polls.filter((p) => p.codeId === id).length;

  return (
    <>
      <p className="notice">{data.generalCodeActive ? t('mGeneralCodeOn') : t('mGeneralCodeOff')}</p>
      <p className="hint">{t('mCodesHelp')}</p>

      <form onSubmit={onCreate} noValidate className="section" aria-labelledby="m-code-h">
        <h3 id="m-code-h">{t('mCodeNew')}</h3>
        <div className="field">
          <label htmlFor="m-clabel">{t('mCodeLabel')}</label>
          <input id="m-clabel" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="m-ccode">{t('mCodeCustom')}</label>
          <input id="m-ccode" maxLength={64} autoComplete="off" spellCheck={false} value={custom} onChange={(e) => setCustom(e.target.value)} aria-describedby="m-ccode-h" />
          <span className="hint" id="m-ccode-h">
            {t('mCodeCustomHint')}
          </span>
        </div>
        <div className="field">
          <label htmlFor="m-cproj">{t('mCodeProject')}</label>
          <select id="m-cproj" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('mNoProject')}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="hint">{t('mCodeProjectHint')}</span>
        </div>
        <div className="field">
          <label htmlFor="m-cexp">{t('mCodeExpires')}</label>
          <input id="m-cexp" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          <span className="hint">
            {t('mCodeExpiresHint')}
            {tz && ` ${t('timeZone')}: ${tz}.`}
          </span>
        </div>
        <button type="submit" className="button primary" disabled={busy}>
          {t('mCodeCreate')}
        </button>
      </form>

      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}

      {issued && (
        <div className="notice warn" role="status">
          <p>
            {t('mCodeIssued')} <strong>{issued.label}</strong>
          </p>
          <CopyField id="m-issued-code" label={t('mCodeValue')} value={issued.code} />
          <p>{t('mCodeIssuedWarn')}</p>
          <button type="button" className="button" onClick={() => setIssued(null)}>
            {t('mDismiss')}
          </button>
        </div>
      )}

      {data.codes.length === 0 ? (
        <p>{t('mNoCodes')}</p>
      ) : (
        <ul className="mlist">
          {data.codes.map((c) => {
            const st = codeState(c, data.now);
            return (
              <li key={c.id} className="mpoll">
                <div className="mhead">
                  <h3>{c.label}</h3>
                  <span className={`badge ${st === 'active' ? 'open' : 'closed'}`}>{t(STATE_KEY[st])}</span>
                </div>
                <p className="mmeta">
                  {c.projectId ? `${t('mProject')}: ${projectName.get(c.projectId) ?? '—'}` : t('mCodeAnyProject')}
                  <br />
                  {t('mCodeUses')}: {c.useCount} · {t('mCodePolls')}: {pollsOf(c.id)}
                  {c.lastUsedAt && ` · ${t('mCodeLastUsed')}: ${formatDateTime(c.lastUsedAt, lang)}`}
                  <br />
                  {c.expiresAt ? `${t('mCodeExpiresOn')}: ${formatDateTime(c.expiresAt, lang)}` : t('mCodeNoExpiry')}
                </p>

                {editId === c.id ? (
                  <form
                    noValidate
                    className="edit-panel"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await run('code.update', { id: c.id, label: editLabel, expiresAt: toIso(editExpires) })) setEditId(null);
                    }}
                  >
                    <div className="field">
                      <label htmlFor={`m-el-${c.id}`}>{t('mCodeLabel')}</label>
                      <input id={`m-el-${c.id}`} maxLength={80} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor={`m-ee-${c.id}`}>{t('mCodeExpires')}</label>
                      <input id={`m-ee-${c.id}`} type="datetime-local" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} />
                      <span className="hint">{t('mCodeExpiresHint')}</span>
                    </div>
                    <div className="row">
                      <button type="submit" className="button primary" disabled={busy}>
                        {t('saveChanges')}
                      </button>
                      <button type="button" className="button" onClick={() => setEditId(null)}>
                        {t('cancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor={`m-cp-${c.id}`}>{t('mCodeProject')}</label>
                      <select
                        id={`m-cp-${c.id}`}
                        value={c.projectId ?? ''}
                        disabled={busy}
                        onChange={(e) => void run('code.update', { id: c.id, projectId: e.target.value || null })}
                      >
                        <option value="">{t('mNoProject')}</option>
                        {data.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row">
                      <button type="button" className="button" disabled={busy} onClick={() => void run('code.update', { id: c.id, active: !c.active })}>
                        {c.active ? t('mCodeDisable') : t('mCodeEnable')}
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          setEditId(c.id);
                          setEditLabel(c.label);
                          setEditExpires(toLocalInput(c.expiresAt));
                        }}
                      >
                        {t('mEditCode')}
                      </button>
                      <button type="button" className="button danger" onClick={() => setDeleteId(c.id)}>
                        {t('mDelete')}
                      </button>
                    </div>
                  </>
                )}

                {deleteId === c.id && (
                  <div role="alertdialog" aria-label={t('mCodeDeleteConfirm')} className="notice warn">
                    <p>{t('mCodeDeleteConfirm')}</p>
                    <div className="row">
                      <button
                        type="button"
                        className="button primary"
                        disabled={busy}
                        onClick={async () => {
                          await run('code.delete', { id: c.id });
                          setDeleteId(null);
                        }}
                      >
                        {t('mDeleteYes')}
                      </button>
                      <button type="button" className="button" onClick={() => setDeleteId(null)}>
                        {t('cancel')}
                      </button>
                    </div>
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
