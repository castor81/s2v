import { useState, type FormEvent } from 'react';
import { useLang, type Localized, type MessageKey } from '../i18n';
import { errorCode, post } from '../lib/api';
import { toIso, toLocalInput } from '../lib/time';
import { ContentFields } from './ContentFields';
import { ScheduleFields } from './ScheduleFields';

interface Props {
  token: string;
  status: 'upcoming' | 'open';
  title: Localized;
  options: Array<{ id: string } & Localized>;
  opensAt: string | null;
  closesAt: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Szavazás módosítása. Nyitás előtt: cím, lehetőségek, nyitás és zárás. Nyitott szavazásnál csak a
 * zárás időpontja módosítható (a szavazók már látják a tartalmat).
 */
export function EditPanel({ token, status, title: t0, options: o0, opensAt, closesAt, onSaved, onCancel }: Props) {
  const { t } = useLang();
  const full = status === 'upcoming';
  const [title, setTitle] = useState<Localized>({ hu: t0.hu ?? '', en: t0.en ?? '' });
  const [options, setOptions] = useState<Localized[]>(o0.map((o) => ({ hu: o.hu ?? '', en: o.en ?? '' })));
  const [opens, setOpens] = useState(toLocalInput(opensAt));
  const [closes, setCloses] = useState(toLocalInput(closesAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = full
      ? { token, title, options, opensAt: toIso(opens), closesAt: toIso(closes) }
      : { token, closesAt: toIso(closes) };
    const r = await post('/api/update', body);
    setBusy(false);
    if (r.ok) {
      onSaved();
      return;
    }
    const code = errorCode(r);
    if (/^(opens_|closes_|window_)/.test(code)) setError('errSchedule');
    else if (code === 'already_open') setError('errAlreadyOpen');
    else if (code === 'closed') setError('errPollClosed');
    else if (r.status === 400) setError('errValidation');
    else if (r.status === 429) setError('errRate');
    else setError('errGeneric');
  }

  return (
    <form onSubmit={onSubmit} noValidate className="section edit-panel" aria-labelledby="edit-h">
      <h2 id="edit-h">{full ? t('editTitle') : t('editClosesTitle')}</h2>
      {full && <ContentFields title={title} setTitle={setTitle} options={options} setOptions={setOptions} />}
      <ScheduleFields
        opens={opens}
        closes={closes}
        setOpens={setOpens}
        setCloses={setCloses}
        opensLocked={!full}
        idPrefix="edit"
      />
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? t('saving') : t('saveChanges')}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
