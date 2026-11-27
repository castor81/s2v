import { useCallback, useState } from 'react';
import { useLang } from '../i18n';
import { post } from '../lib/api';
import { readEditor, readMade, writeEditor, writeMade, type EditorSession, type MadePoll } from '../lib/editor';
import { GlassSidebar, type SideItem } from '../components/GlassSidebar';
import { PadlockSignIn } from '../components/PadlockSignIn';
import { PollPlanner, type CreatedPoll } from '../components/PollPlanner';
import { QrBlock } from '../components/QrBlock';
import { CopyField } from '../components/CopyField';
import { pick } from '../i18n';
import { formatDateTime } from '../lib/time';

type Section = 'planner' | 'links';

/** Szerkesztői terület: számkódos belépés után szavazástervező és a munkamenetben létrehozott szavazások linkjei. */
export function EditorPage() {
  const { t, lang } = useLang();
  const [session, setSession] = useState<EditorSession | null>(readEditor);
  const [made, setMade] = useState<MadePoll[]>(readMade);
  const [section, setSection] = useState<Section>('planner');

  const logout = useCallback(() => {
    writeEditor(null);
    writeMade(null);
    setSession(null);
    setMade([]);
    setSection('planner');
  }, []);

  if (!session) {
    return (
      <PadlockSignIn
        onSignedIn={(code, projectName) => {
          const s = { code, projectName };
          writeEditor(s);
          setSession(s);
        }}
      />
    );
  }

  const items: SideItem<Section>[] = [
    { key: 'planner', label: t('navPlanner'), icon: 'plan' },
    { key: 'links', label: t('navLinks'), icon: 'qr' },
  ];

  return (
    <div className="workspace">
      <GlassSidebar
        items={items}
        active={section}
        onSelect={setSection}
        title={t('sbEditor')}
        subtitle={session.projectName ? `${t('mProject')}: ${session.projectName}` : undefined}
        logoutLabel={t('mLogout')}
        onLogout={logout}
      />
      <div className="wcontent">
        {section === 'planner' ? (
          <PollPlanner
            fixedProject={session.projectName}
            submit={(p) => post<CreatedPoll>('/api/create', { gateCode: session.code, title: p.title, options: p.options, opensAt: p.opensAt, closesAt: p.closesAt })}
            onCreated={(c, title) => {
              const next = [{ ...c, title, createdAt: new Date().toISOString() }, ...made];
              setMade(next);
              writeMade(next);
            }}
            onUnauthorized={logout}
          />
        ) : (
          <>
            <h1>{t('navLinks')}</h1>
            <p className="hint">{t('lnMineHelp')}</p>
            {made.length === 0 ? (
              <p>{t('lnMineNone')}</p>
            ) : (
              <ul className="mlist">
                {made.map((m) => (
                  <li key={m.slug} className="mpoll">
                    <div className="mhead">
                      <h3>{pick(m.title, lang)}</h3>
                    </div>
                    <p className="mmeta">{formatDateTime(m.createdAt, lang)}</p>
                    <CopyField id={`ev-${m.slug}`} label={t('voteLink')} value={m.voteUrl} />
                    <CopyField id={`eo-${m.slug}`} label={t('organizerLink')} value={m.organizerUrl} />
                    <details className="mqr">
                      <summary>{t('dashQrHeading')}</summary>
                      <QrBlock slug={m.slug} voteUrl={m.voteUrl} />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
