import type { Lang, MessageKey } from '../i18n';
import { rankOptions } from './ranking';
import type { MPoll, MProject } from './master';

/** Egy CSV-cella. A képlet-indító karakterekkel kezdődő szöveget aposztróf védi (táblázatkezelő-injekció ellen). */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Array<string | number>>, delimiter: string): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(delimiter)).join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HEAD: Record<Lang, string[]> = {
  hu: ['Projekt', 'Azonosító', 'Cím (HU)', 'Cím (EN)', 'Állapot', 'Nyitás', 'Zárás', 'Lezárva', 'Összes szavazat', 'Helyezés', 'Lehetőség (HU)', 'Lehetőség (EN)', 'Szavazat', 'Arány (%)'],
  en: ['Project', 'ID', 'Title (HU)', 'Title (EN)', 'Status', 'Opens', 'Closes', 'Closed', 'Total votes', 'Rank', 'Option (HU)', 'Option (EN)', 'Votes', 'Share (%)'],
};
const STATUS_KEY: Record<MPoll['status'], MessageKey> = { open: 'statusOpen', closed: 'statusClosed', upcoming: 'statusUpcoming' };

/** A szavazások eredménye soronként (szavazás × lehetőség); az időpontok ISO 8601 (UTC) formátumúak. */
export function pollsToRows(
  polls: MPoll[],
  projects: MProject[],
  lang: Lang,
  t: (k: MessageKey) => string,
): Array<Array<string | number>> {
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const dec = (n: number) => (lang === 'hu' ? String(n).replace('.', ',') : String(n));
  const rows: Array<Array<string | number>> = [HEAD[lang]];
  for (const p of polls) {
    const total = p.stats.votes;
    for (const r of rankOptions(p.options, p.stats.counts)) {
      rows.push([
        (p.projectId && projectName.get(p.projectId)) || '',
        p.slug,
        p.title.hu ?? '',
        p.title.en ?? '',
        t(STATUS_KEY[p.status]),
        p.opensAt ?? '',
        p.closesAt ?? '',
        p.closedAt ?? '',
        total,
        r.rank,
        r.item.hu ?? '',
        r.item.en ?? '',
        r.count,
        dec(total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0),
      ]);
    }
  }
  return rows;
}

export function exportPolls(
  name: string,
  polls: MPoll[],
  projects: MProject[],
  lang: Lang,
  t: (k: MessageKey) => string,
): void {
  const day = new Date().toISOString().slice(0, 10);
  const safe = name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
  downloadCsv(`s2v-${safe}-${day}.csv`, toCsv(pollsToRows(polls, projects, lang, t), lang === 'hu' ? ';' : ','));
}
