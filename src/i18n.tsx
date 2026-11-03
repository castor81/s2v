import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'hu' | 'en';
export type Localized = { hu?: string; en?: string };

const dict = {
  hu: {
    appName: 'S2V · Scan2Vote',
    orgName: 'NKE Hadtudományi és Honvédtisztképző Kar',
    logoAlt: 'NKE HHK logó',
    footerText: 'Nemzeti Közszolgálati Egyetem · Hadtudományi és Honvédtisztképző Kar · Katonai Távoktatási és Vizsgaközpont',
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
    statusLabel: 'Állapot',
    statusOpen: 'Nyitott',
    statusClosed: 'Lezárt',
    statusUpcoming: 'Még nem indult',
    statVotes: 'Leadott szavazat',
    statSessions: 'Megnyitás',
    statCompletion: 'Leadási arány',
    statMedian: 'Medián idő a szavazatig',
    secondsShort: 'mp',
    resultsHeading: 'Eredmények',
    colOption: 'Lehetőség',
    colVotes: 'Szavazat',
    colShare: 'Arány',
    noVotesYet: 'Még nem érkezett szavazat.',
    noData: 'Nincs adat',
    closePoll: 'Szavazás lezárása',
    closeConfirm: 'Biztosan lezárja? A szavazók ezután nem tudnak szavazni.',
    closeYes: 'Igen, lezárom',
    cancel: 'Mégsem',
    reopenPoll: 'Szavazás újranyitása',
    updatedAt: 'Utolsó frissítés',
    autoRefresh: 'Az eredmények 3 másodpercenként frissülnek, amíg a szavazás nyitott; a lista a szavazatok száma szerint rendeződik.',
    refreshNow: 'Frissítés most',
    dashQrHeading: 'A szavazás QR-kódja',
    dashNotFoundTitle: 'A szervezői hivatkozás érvénytelen',
    dashNotFoundText: 'Ellenőrizze a hivatkozást. Elveszett hivatkozás nem állítható vissza; ilyenkor új szavazást kell létrehozni.',
    dashError: 'Az eredményeket most nem sikerült lekérni. Újrapróbálkozunk.',
    statusChangeError: 'Az állapot módosítása nem sikerült. Kérjük, próbálja újra.',
    scheduleLegend: 'Időzítés',
    scheduleHelp: 'Beállíthatja, mikor nyíljon és mikor záruljon a szavazás; akár hetekkel előre is. Nyitás előtt a szavazás módosítható.',
    timeZone: 'Időzóna',
    opensAtLabel: 'Nyitás időpontja',
    closesAtLabel: 'Zárás időpontja',
    opensEmptyHint: 'Üresen hagyva a szavazás azonnal megnyílik.',
    closesEmptyHint: 'Üresen hagyva a szavazás csak kézzel zárható le.',
    opensLocked: 'A szavazás már megnyílt, a nyitás időpontja nem módosítható.',
    errSchedule: 'Az időzítés érvénytelen: a zárásnak a jövőben, a nyitás után legalább 1 perccel kell lennie (legfeljebb 1 évre előre).',
    scheduleOpens: 'Nyitás',
    scheduleCloses: 'Zárás',
    scheduleNow: 'azonnal',
    scheduleManual: 'kézi lezárással',
    upcomingAt: 'Ez a szavazás még nem indult el. Nyitás:',
    closesAtVote: 'A szavazás zárása:',
    editBtn: 'Szavazás módosítása (nyitás előtt)',
    editClosesBtn: 'Zárás időpontjának módosítása',
    editTitle: 'Szavazás módosítása',
    editClosesTitle: 'Zárás időpontjának módosítása',
    saveChanges: 'Mentés',
    saving: 'Mentés…',
    errAlreadyOpen: 'A szavazás már megnyílt: a tartalma és a nyitás időpontja már nem módosítható.',
    errPollClosed: 'A szavazás le van zárva. Újranyitás után módosítható a zárás időpontja.',
    colRank: '#',
    leaderAnnounce: 'Az élen:',
  },
  en: {
    appName: 'S2V · Scan2Vote',
    orgName: 'NUPS Faculty of Military Sciences and Officer Training',
    logoAlt: 'NKE HHK logo',
    footerText: 'National University of Public Service · Faculty of Military Sciences and Officer Training · Military Distance Learning and Examination Centre',
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
    statusLabel: 'Status',
    statusOpen: 'Open',
    statusClosed: 'Closed',
    statusUpcoming: 'Not started yet',
    statVotes: 'Votes cast',
    statSessions: 'Visits',
    statCompletion: 'Completion rate',
    statMedian: 'Median time to vote',
    secondsShort: 's',
    resultsHeading: 'Results',
    colOption: 'Option',
    colVotes: 'Votes',
    colShare: 'Share',
    noVotesYet: 'No votes yet.',
    noData: 'No data',
    closePoll: 'Close the poll',
    closeConfirm: 'Are you sure? Voters will no longer be able to vote.',
    closeYes: 'Yes, close it',
    cancel: 'Cancel',
    reopenPoll: 'Reopen the poll',
    updatedAt: 'Last updated',
    autoRefresh: 'Results refresh every 3 seconds while the poll is open; the list is ordered by number of votes.',
    refreshNow: 'Refresh now',
    dashQrHeading: 'QR code for the poll',
    dashNotFoundTitle: 'This organizer link is not valid',
    dashNotFoundText: 'Please check the link. A lost link cannot be recovered; create a new poll instead.',
    dashError: 'The results could not be loaded right now. We will try again.',
    statusChangeError: 'The status could not be changed. Please try again.',
    scheduleLegend: 'Schedule',
    scheduleHelp: 'Set when the poll opens and closes, even weeks ahead. The poll can be edited until it opens.',
    timeZone: 'Time zone',
    opensAtLabel: 'Opening time',
    closesAtLabel: 'Closing time',
    opensEmptyHint: 'If left empty, the poll opens immediately.',
    closesEmptyHint: 'If left empty, the poll can only be closed manually.',
    opensLocked: 'The poll has already opened; the opening time can no longer be changed.',
    errSchedule: 'The schedule is not valid: closing must be in the future and at least 1 minute after opening (up to 1 year ahead).',
    scheduleOpens: 'Opens',
    scheduleCloses: 'Closes',
    scheduleNow: 'immediately',
    scheduleManual: 'manually',
    upcomingAt: 'This poll has not started yet. Opens:',
    closesAtVote: 'The poll closes:',
    editBtn: 'Edit poll (before it opens)',
    editClosesBtn: 'Change the closing time',
    editTitle: 'Edit poll',
    editClosesTitle: 'Change the closing time',
    saveChanges: 'Save',
    saving: 'Saving…',
    errAlreadyOpen: 'The poll has already opened: its content and opening time can no longer be changed.',
    errPollClosed: 'The poll is closed. Reopen it to change the closing time.',
    colRank: '#',
    leaderAnnounce: 'Leading:',
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
