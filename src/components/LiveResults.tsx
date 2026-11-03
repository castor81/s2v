import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { post } from '../lib/api';
import { getDeviceId } from '../lib/device';
import { ResultsTable } from './ResultsTable';

interface Live {
  options: Array<{ id: string; hu?: string; en?: string }>;
  status: 'upcoming' | 'open' | 'closed';
  counts: Record<string, number>;
  votes: number;
}

const REFRESH_MS = 10_000;

/** A szavazó élő állása a szavazat leadása után; nyitott szavazásnál 10 mp-enként frissül. */
export function LiveResults({ slug }: { slug: string }) {
  const { t, lang } = useLang();
  const [live, setLive] = useState<Live | null>(null);
  const [failed, setFailed] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const statusRef = useRef<Live['status'] | null>(null);

  const load = useCallback(async () => {
    const r = await post<Live>('/api/live', { slug, deviceId: getDeviceId() });
    if (r.ok) {
      const d = r.data as Live;
      statusRef.current = d.status;
      setLive(d);
      setFailed(false);
      setUpdated(new Date());
    } else {
      setFailed(true);
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && statusRef.current !== 'closed') void load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!live) {
    return failed ? (
      <p role="alert" className="error">
        {t('liveError')}
      </p>
    ) : (
      <p role="status">{t('loading')}</p>
    );
  }

  return (
    <section className="section" aria-labelledby="live-h">
      <h2 id="live-h">{t('liveHeading')}</h2>
      <ResultsTable options={live.options} counts={live.counts} total={live.votes} />
      <p className="hint">
        {t('liveTotal')}: {live.votes}.{' '}
        {live.status === 'closed' ? t('liveClosed') : t('liveHint')}
        {updated && ` ${t('updatedAt')}: ${updated.toLocaleTimeString(lang === 'hu' ? 'hu-HU' : 'en-GB')}.`}
      </p>
      {failed && (
        <p role="alert" className="error">
          {t('liveError')}
        </p>
      )}
    </section>
  );
}
