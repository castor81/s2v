import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, type MessageKey } from '../i18n';
import { masterPost, type Overview } from '../lib/master';
import { GlassSidebar, type SideItem } from '../components/GlassSidebar';
import { PollPlanner, type CreatedPoll } from '../components/PollPlanner';
import { LinksTab } from '../components/master/LinksTab';
import { StatsTab } from '../components/master/StatsTab';
import { PollsTab } from '../components/master/PollsTab';
import { ProjectsTab } from '../components/master/ProjectsTab';
import { CodesTab } from '../components/master/CodesTab';

type Tab = 'polls' | 'planner' | 'links' | 'stats' | 'projects' | 'codes';
const REFRESH_MS = 5000;

export function MasterPage({ code, onLogout }: { code: string; onLogout: () => void }) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>('polls');
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const r = await masterPost<Overview>(code, 'overview');
    if (!alive.current) return;
    if (r.ok) {
      setData(r.data as Overview);
      setLoadError(false);
      setUpdated(new Date());
    } else if (r.status === 401 || r.status === 503) {
      onLogout();
    } else {
      setLoadError(true);
    }
  }, [code, onLogout]);

  useEffect(() => {
    alive.current = true;
    void reload();
    // Látható lapnál 5 mp-enként frissítünk: a futó szavazások szavazatszámai élőben változnak.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [reload]);

  // A felület titkos kezelőfelület: keresők ne indexeljék.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  const items: SideItem<Tab>[] = [
    { key: 'polls', label: t('mTabPolls'), icon: 'list' },
    { key: 'planner', label: t('navPlanner'), icon: 'plan' },
    { key: 'links', label: t('navLinks'), icon: 'qr' },
    { key: 'stats', label: t('navStats'), icon: 'stats' },
    { key: 'projects', label: t('mTabProjects'), icon: 'folder' },
    { key: 'codes', label: t('mTabCodes'), icon: 'key' },
  ];
  const heading: Record<Tab, MessageKey> = {
    polls: 'mTabPolls',
    planner: 'navPlanner',
    links: 'navLinks',
    stats: 'navStats',
    projects: 'mTabProjects',
    codes: 'mTabCodes',
  };

  return (
    <div className="workspace">
      <GlassSidebar items={items} active={tab} onSelect={setTab} title={t('sbMaster')} subtitle={t('mTitle')} logoutLabel={t('mLogout')} onLogout={onLogout} />
      <div className="wcontent">
        {!data ? (
          loadError ? (
            <p role="alert" className="error">
              {t('dashError')}
            </p>
          ) : (
            <p role="status">{t('loading')}</p>
          )
        ) : (
          <>
            {(tab === 'polls' || tab === 'projects' || tab === 'codes') && <h1>{t(heading[tab])}</h1>}
            {tab === 'polls' && <PollsTab code={code} data={data} reload={reload} />}
            {tab === 'planner' && (
              <PollPlanner
                projects={data.projects}
                submit={(p) => masterPost<CreatedPoll>(code, 'poll.create', { ...p })}
                onCreated={() => void reload()}
              />
            )}
            {tab === 'links' && <LinksTab data={data} />}
            {tab === 'stats' && <StatsTab data={data} />}
            {tab === 'projects' && <ProjectsTab code={code} data={data} reload={reload} />}
            {tab === 'codes' && <CodesTab code={code} data={data} reload={reload} />}
            <p className="hint">
              {t('mAutoRefresh')}
              {updated && ` ${t('updatedAt')}: ${updated.toLocaleTimeString(lang === 'hu' ? 'hu-HU' : 'en-GB')}.`}
            </p>
            {loadError && (
              <p role="alert" className="error">
                {t('dashError')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
