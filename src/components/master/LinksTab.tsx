import { useMemo, useState } from 'react';
import { pick, useLang, type MessageKey } from '../../i18n';
import type { Overview, PollStatus } from '../../lib/master';
import { CopyField } from '../CopyField';
import { QrBlock } from '../QrBlock';

const STATUS_KEY: Record<PollStatus, MessageKey> = { open: 'statusOpen', closed: 'statusClosed', upcoming: 'statusUpcoming' };

/** QR-kódok és szavazói hivatkozások az összes (nem archivált) szavazáshoz. */
export function LinksTab({ data }: { data: Overview }) {
  const { t, lang } = useLang();
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.polls.filter((p) => !p.archivedAt && (!q || `${p.title.hu ?? ''} ${p.title.en ?? ''} ${p.slug}`.toLowerCase().includes(q)));
  }, [data.polls, query]);

  return (
    <>
      <h1>{t('navLinks')}</h1>
      <p className="hint">{t('lnHelp')}</p>
      <div className="field">
        <label htmlFor="ln-q">{t('mSearch')}</label>
        <input id="ln-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <p>{t('mNoPolls')}</p>
      ) : (
        <ul className="mlist">
          {list.map((p) => (
            <li key={p.id} className={`mpoll ${p.status}`}>
              <div className="mhead">
                <h3>{pick(p.title, lang)}</h3>
                <span className={`badge ${p.status}`}>{t(STATUS_KEY[p.status])}</span>
              </div>
              <CopyField id={`ln-${p.id}`} label={t('voteLink')} value={p.voteUrl} />
              <details className="mqr">
                <summary>{t('dashQrHeading')}</summary>
                <QrBlock slug={p.slug} voteUrl={p.voteUrl} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
