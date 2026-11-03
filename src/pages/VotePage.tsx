import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { pick, useLang, type Localized, type MessageKey } from '../i18n';
import { errorCode, post } from '../lib/api';
import { getDeviceId } from '../lib/device';
import { formatDateTime } from '../lib/time';

interface PollView {
  title: Localized;
  options: Array<{ id: string } & Localized>;
  status: 'upcoming' | 'open' | 'closed';
  alreadyVoted: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error' }
  | { kind: 'ready'; poll: PollView; voted: boolean };

export function VotePage() {
  const { slug = '' } = useParams();
  const { lang, t } = useLang();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [choice, setChoice] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<MessageKey | ''>('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Újratöltéskor (nyitás pillanatában) nem villantjuk vissza a betöltés-képernyőt.
    if (reload === 0) setState({ kind: 'loading' });
    post<PollView>('/api/open', { slug, deviceId: getDeviceId() }).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        const poll = r.data as PollView;
        setState({ kind: 'ready', poll, voted: poll.alreadyVoted });
      } else if (r.status === 404 || r.status === 400) {
        setState({ kind: 'notfound' });
      } else {
        setState({ kind: 'error' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, reload]);

  // Induló szavazásnál a nyitás pillanatában automatikusan újratöltünk. A véletlen késleltetés (0–8 mp)
  // szétteríti a terhelést, hogy a terem összes telefonja ne ugyanabban a másodpercben kérdezzen.
  const opensAt = state.kind === 'ready' && state.poll.status === 'upcoming' ? state.poll.opensAt : null;
  useEffect(() => {
    if (!opensAt) return;
    const wait = Math.max(0, Date.parse(opensAt) - Date.now()) + Math.random() * 8000;
    // A setTimeout felső korlátja ~24 nap: hosszú várakozásnál 6 óránként újraértékelünk.
    const id = setTimeout(() => setReload((n) => n + 1), Math.min(wait, 6 * 3600 * 1000));
    return () => clearTimeout(id);
  }, [opensAt, reload]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state.kind !== 'ready') return;
    if (!choice) {
      setMessage('errPickOption');
      return;
    }
    setMessage('');
    setSending(true);
    const r = await post('/api/vote', { slug, deviceId: getDeviceId(), optionId: choice });
    setSending(false);
    if (r.ok) {
      setState({ ...state, voted: true });
      return;
    }
    const code = errorCode(r);
    if (code === 'already_voted') setState({ ...state, voted: true });
    else if (code === 'not_open') setState({ ...state, poll: { ...state.poll, status: 'closed' } });
    else if (r.status === 429) setMessage('errRate');
    else setMessage('errGeneric');
  }

  if (state.kind === 'loading') return <p role="status">{t('loading')}</p>;
  if (state.kind === 'notfound') {
    return (
      <>
        <h1>{t('notFoundTitle')}</h1>
        <p>{t('notFoundText')}</p>
      </>
    );
  }
  if (state.kind === 'error') return <p role="alert">{t('errGeneric')}</p>;

  const { poll, voted } = state;
  const title = pick(poll.title, lang);

  if (voted) {
    return (
      <>
        <h1>{title}</h1>
        <p role="status" className="notice">
          {poll.alreadyVoted ? t('alreadyVoted') : t('thanksTitle')}
        </p>
      </>
    );
  }
  if (poll.status !== 'open') {
    return (
      <>
        <h1>{title}</h1>
        <p role="status" className="notice">
          {poll.status === 'upcoming'
            ? poll.opensAt
              ? `${t('upcomingAt')} ${formatDateTime(poll.opensAt, lang)}`
              : t('upcoming')
            : t('closed')}
        </p>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset>
        <legend>
          <h1>{title}</h1>
          <span className="hint">{t('voteChoose')}</span>
          {poll.closesAt && (
            <span className="hint">
              {t('closesAtVote')} {formatDateTime(poll.closesAt, lang)}
            </span>
          )}
        </legend>
        {poll.options.map((o) => (
          <label key={o.id} className="choice">
            <input
              type="radio"
              name="option"
              value={o.id}
              checked={choice === o.id}
              onChange={() => {
                setChoice(o.id);
                setMessage('');
              }}
            />
            <span>{pick(o, lang)}</span>
          </label>
        ))}
      </fieldset>
      {message && (
        <p role="alert" className="error">
          {t(message)}
        </p>
      )}
      <button type="submit" className="button primary" disabled={sending}>
        {sending ? t('voteSending') : t('voteSubmit')}
      </button>
    </form>
  );
}
