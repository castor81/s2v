import { useState, type ReactNode } from 'react';
import { useLang } from '../i18n';

export type IconName = 'list' | 'plan' | 'qr' | 'stats' | 'folder' | 'key' | 'log' | 'logout';

const PATHS: Record<IconName, ReactNode> = {
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M12 13v4M10 15h4" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v0M17 20h4M20 17v3" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  folder: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </>
  ),
  log: (
    <>
      <path d="M12 7v5l3 2" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  logout: <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M15 16l5-4-5-4M20 12H9" />,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="gicon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export interface SideItem<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

interface Props<K extends string> {
  items: SideItem<K>[];
  active: K;
  onSelect: (k: K) => void;
  title: string;
  subtitle?: string;
  note?: string;
  logoutLabel: string;
  onLogout: () => void;
}

/**
 * Üveghatású (glassmorphism) oldalsáv az NKE színeivel: áttetsző, elmosott háttér, kiemelt aktív menüpont.
 * Keskeny képernyőn a "Menü" gombbal nyitható/zárható.
 */
export function GlassSidebar<K extends string>({ items, active, onSelect, title, subtitle, note, logoutLabel, onLogout }: Props<K>) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <aside className={`gside${open ? ' open' : ''}`}>
      <div className="gside-head">
        <img src="/brand/nke-hhk-logo.png" alt="" width={44} height={44} />
        <div>
          <div className="gside-title">{title}</div>
          {subtitle && <div className="gside-sub">{subtitle}</div>}
        </div>
        <button type="button" className="gside-toggle" aria-expanded={open} aria-controls="gside-body" onClick={() => setOpen(!open)}>
          {t('sbMenu')}
        </button>
      </div>
      <div id="gside-body" className="gside-body">
        {note && <p className="gside-note">{note}</p>}
        <nav aria-label={t('sbNav')}>
          <ul className="gside-list">
            {items.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  className="gside-item"
                  aria-current={active === it.key ? 'page' : undefined}
                  onClick={() => {
                    onSelect(it.key);
                    setOpen(false);
                  }}
                >
                  <Icon name={it.icon} />
                  <span>{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="gside-sep" />
        <button type="button" className="gside-item" onClick={onLogout}>
          <Icon name="logout" />
          <span>{logoutLabel}</span>
        </button>
      </div>
    </aside>
  );
}
