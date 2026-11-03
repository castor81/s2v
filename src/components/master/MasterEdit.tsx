import { useState, type FormEvent } from 'react';
import { useLang, type Localized, type MessageKey } from '../../i18n';
import { toIso, toLocalInput } from '../../lib/time';
import { masterError, masterPost, type MPoll } from '../../lib/master';
import { ContentFields } from '../ContentFields';
import { ScheduleFields } from '../ScheduleFields';

interface Props {
  code: string;
  poll: MPoll;
  onSaved: () => void;
  onCancel: () => void;
}

/** Még nem nyílt szavazás teljes módosítása a masteren (cím, lehetőségek, nyitás, zárás). */
export function MasterEdit({ code, poll, onSaved, onCancel }: Props) {
  const { t } = useLang();
  const [title, setTitle] = useState<Localized>({ hu: poll.title.hu ?? '', en: poll.title.en ?? '' });
  const [options, setOptions] = useState<Localized[]>(poll.options.map((o) => ({ hu: o.hu ?? '', en: o.en ?? '' })));
  const [opens, setOpens] = useState(toLocalInput(poll.opensAt));
  const [closes, setCloses] = useState(toLocalInput(poll.closesAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | ''>('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const r = await masterPost(code, 'poll.update', {
      id: poll.id,
      title,
      options,
      opensAt: toIso(opens),
      closesAt: toIso(closes),
    });
    setBusy(false);
    if (r.ok) onSaved();
    else setError(masterError(r));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="section edit-panel" aria-labelledby={`edit-h-${poll.id}`}>
      <h4 id={`edit-h-${poll.id}`}>{t('editTitle')}</h4>
      <ContentFields title={title} setTitle={setTitle} options={options} setOptions={setOptions} />
      <ScheduleFields opens={opens} closes={closes} setOpens={setOpens} setCloses={setCloses} idPrefix={`m-edit-${poll.id}`} />
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
