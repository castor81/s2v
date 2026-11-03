import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'hu' | 'en';
export type Localized = { hu?: string; en?: string };

const dict = {
  hu: {
    appName: 'S2V · Scan2Vote',
    language: 'Nyelv',
    home: 'Gyors közönségszavazás QR-kóddal.',
    homeCreate: 'Új szavazás létrehozása',
    loading: 'Betöltés…',
    notFoundTitle: 'A szavazás nem található',
    notFoundText: 'Ellenőrizze a QR-kódot vagy a hivatkozást. Lehet, hogy a szavazás már törlődött.',
    voteSubmit: 'Szavazat leadása',
    voteChoose: 'Válasszon egy lehetőséget',
    voteSending: 'Küldés…',
    thanksTitle: 'Köszönjük, a szavazatát rögzítettük.',
    alreadyVoted: 'Erről az eszközről már szavaztak ebben a szavazásban.',
    notOpen: 'Ez a szavazás jelenleg nem fogad szavazatot.',
    upcoming: 'Ez a szavazás még nem indult el.',
    closed: 'Ez a szavazás lezárult.',
    errPickOption: 'Kérjük, válasszon egy lehetőséget.',
    errGeneric: 'Hiba történt. Kérjük, próbálja újra.',
    errRate: 'Túl sok kérés érkezett. Kérjük, próbálja újra egy perc múlva.',
    createTitle: 'Új szavazás',
    gateCode: 'Belépési kód',
    gateHelp: 'A szavazás létrehozásához szükséges kód.',
    pollTitle: 'A szavazás címe',
    pollTitleHu: 'Cím (magyarul)',
    pollTitleEn: 'Cím (angolul)',
    optionsLegend: 'Válaszlehetőségek (2–10, egyválasztós)',
    optionHu: 'Magyarul',
    optionEn: 'Angolul',
    optionN: 'Lehetőség',
    addOption: 'Lehetőség hozzáadása',
    removeOption: 'Törlés',
    langHint: 'Legalább az egyik nyelven töltse ki. Ha csak egy nyelven adja meg, mindenkinek az jelenik meg.',
    createSubmit: 'Szavazás létrehozása',
    creating: 'Létrehozás…',
    errGate: 'Hibás belépési kód.',
    errValidation: 'Kérjük, ellenőrizze a megadott adatokat (cím, legalább 2 lehetőség).',
    resultTitle: 'A szavazás elkészült',
    qrAlt: 'QR-kód a szavazáshoz',
    voteLink: 'Szavazói hivatkozás (a QR-kód alatt is ezt kell feltüntetni)',
    organizerLink: 'Szervezői hivatkozás',
    organizerWarn: 'Mentse el most! Ez a hivatkozás csak egyszer jelenik meg, később nem kérhető le.',
    copy: 'Másolás',
    copied: 'Másolva',
    downloadPng: 'QR letöltése (PNG)',
    downloadSvg: 'QR letöltése (SVG)',
    newPoll: 'Új szavazás',
    dashboardTitle: 'Szervezői felület',
    dashboardSoon: 'Az analitikai dashboard a 2. iterációban készül el.',
  },
  en: {
    appName: 'S2V · Scan2Vote',
    language: 'Language',
    home: 'Quick audience polls with a QR code.',
    homeCreate: 'Create a new poll',
    loading: 'Loading…',
    notFoundTitle: 'Poll not found',
    notFoundText: 'Please check the QR code or the link. The poll may already have been deleted.',
    voteSubmit: 'Submit vote',
    voteChoose: 'Choose one option',
    voteSending: 'Sending…',
    thanksTitle: 'Thank you, your vote has been recorded.',
    alreadyVoted: 'A vote has already been cast from this device in this poll.',
    notOpen: 'This poll is not accepting votes right now.',
    upcoming: 'This poll has not started yet.',
    closed: 'This poll is closed.',
    errPickOption: 'Please choose an option.',
    errGeneric: 'Something went wrong. Please try again.',
    errRate: 'Too many requests. Please try again in a minute.',
    createTitle: 'New poll',
    gateCode: 'Access code',
    gateHelp: 'The code required to create a poll.',
    pollTitle: 'Poll title',
    pollTitleHu: 'Title (Hungarian)',
    pollTitleEn: 'Title (English)',
    optionsLegend: 'Answer options (2–10, single choice)',
    optionHu: 'Hungarian',
    optionEn: 'English',
    optionN: 'Option',
    addOption: 'Add option',
    removeOption: 'Remove',
    langHint: 'Fill in at least one language. If only one is given, everyone sees that one.',
    createSubmit: 'Create poll',
    creating: 'Creating…',
    errGate: 'Wrong access code.',
    errValidation: 'Please check your input (a title and at least 2 options).',
    resultTitle: 'Your poll is ready',
    qrAlt: 'QR code for the poll',
    voteLink: 'Voting link (also print it under the QR code)',
    organizerLink: 'Organizer link',
    organizerWarn: 'Save it now! This link is shown only once and cannot be retrieved later.',
    copy: 'Copy',
    copied: 'Copied',
    downloadPng: 'Download QR (PNG)',
    downloadSvg: 'Download QR (SVG)',
    newPoll: 'New poll',
    dashboardTitle: 'Organizer area',
    dashboardSoon: 'The analytics dashboard is coming in iteration 2.',
  },
} as const;

export type MessageKey = keyof (typeof dict)['hu'];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: MessageKey) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const STORAGE_KEY = 's2v_lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'hu' || saved === 'en') return saved;
  } catch {
    /* a tárolás nem elérhető: böngészőnyelv alapján döntünk */
  }
  return navigator.language?.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          /* nem kritikus */
        }
      },
      t: (k) => dict[lang][k],
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('LangProvider hiányzik');
  return v;
}

/** A szavazás tartalmából a kiválasztott nyelvet adja; ha az nincs megadva, a másikat. */
export function pick(text: Localized | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] ?? text.hu ?? text.en ?? '';
}
