import { useState } from 'react';
import { useLang } from '../../i18n';
import type { Overview } from '../../lib/master';
import { AuditTab } from './AuditTab';
import { TechTab } from './TechTab';

type View = 'activity' | 'tech';

/** Napló: tevékenység (ki mit csinált) és technikai lefolyás (hívások, hibák) két nézetben. */
export function LogTab({ code, data }: { code: string; data: Overview }) {
  const { t } = useLang();
  const [view, setView] = useState<View>('activity');
  return (
    <>
      <div className="row" role="group" aria-label={t('mTabAudit')}>
        <button type="button" className={`button${view === 'activity' ? ' primary' : ''}`} aria-pressed={view === 'activity'} onClick={() => setView('activity')}>
          {t('lgActivity')}
        </button>
        <button type="button" className={`button${view === 'tech' ? ' primary' : ''}`} aria-pressed={view === 'tech'} onClick={() => setView('tech')}>
          {t('lgTech')}
        </button>
      </div>
      {view === 'activity' ? <AuditTab code={code} /> : <TechTab code={code} data={data} />}
    </>
  );
}
