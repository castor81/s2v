import { useState, type FormEvent } from 'react';
import { useLang, type MessageKey } from '../../i18n';
import { exportPolls } from '../../lib/csv';
import { masterError, masterPost, type Overview } from '../../lib/master';

interface Props {
  code: string;
  data: Overview;
  reload: () => Promise<void>;
}

export function ProjectsTab({ code, data, reload }: Props) {
  const { t, lang } = useLang();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function run(action: string, extra: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError('');
    const r = await masterPost(code, action, extra);
    setBusy(false);
    if (!r.ok) {
      setError(masterError(r));
      return false;
    }
    await reload();
    return true;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (await run('project.create', { name })) setName('');
  }

  const pollsOf = (id: string) => data.polls.filter((p) => p.projectId === id);

  return (
    <>
      <p className="hint">{t('mProjectsHelp')}</p>

      <form onSubmit={onCreate} noValidate className="row mform">
        <div className="field grow">
          <label htmlFor="m-pname">{t('mProjectName')}</label>
          <input id="m-pname" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="button primary" disabled={busy}>
          {t('mProjectCreate')}
        </button>
      </form>

      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}

      {data.projects.length === 0 ? (
        <p>{t('mNoProjects')}</p>
      ) : (
        <ul className="mlist">
          {data.projects.map((p) => {
            const polls = pollsOf(p.id);
            const running = polls.filter((x) => x.status === 'open').length;
            const votes = polls.reduce((n, x) => n + x.stats.votes, 0);
            return (
              <li key={p.id} className="mpoll">
                {editId === p.id ? (
                  <form
                    className="row"
                    noValidate
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await run('project.rename', { id: p.id, name: editName })) setEditId(null);
                    }}
                  >
                    <div className="field grow">
                      <label htmlFor={`m-pr-${p.id}`}>{t('mProjectName')}</label>
                      <input id={`m-pr-${p.id}`} maxLength={80} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <button type="submit" className="button primary" disabled={busy}>
                      {t('saveChanges')}
                    </button>
                    <button type="button" className="button" onClick={() => setEditId(null)}>
                      {t('cancel')}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="mhead">
                      <h3>{p.name}</h3>
                    </div>
                    <p className="mmeta">
                      {polls.length} {t('mPollsCount')} · {running} {t('mRunningCount')} · {votes} {t('mVotesShort')}
                    </p>
                    <div className="row">
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          setEditId(p.id);
                          setEditName(p.name);
                        }}
                      >
                        {t('mRename')}
                      </button>
                      <button
                        type="button"
                        className="button"
                        disabled={polls.length === 0}
                        onClick={() => exportPolls(p.name, polls, data.projects, lang, t)}
                      >
                        {t('mExportCsv')}
                      </button>
                      <button type="button" className="button danger" onClick={() => setDeleteId(p.id)}>
                        {t('mDelete')}
                      </button>
                    </div>
                    {deleteId === p.id && (
                      <div role="alertdialog" aria-label={t('mProjectDeleteConfirm')} className="notice warn">
                        <p>{t('mProjectDeleteConfirm')}</p>
                        <div className="row">
                          <button
                            type="button"
                            className="button primary"
                            disabled={busy}
                            onClick={async () => {
                              await run('project.delete', { id: p.id });
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
