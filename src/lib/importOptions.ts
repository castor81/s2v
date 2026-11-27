// Válaszlehetőségek importja Excel (.xlsx) vagy CSV/TXT fájlból. Minden feldolgozás a böngészőben történik,
// a fájl nem kerül a szerverre. Az xlsx-olvasó (fflate) csak az első xlsx-importnál töltődik be.

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const UNZIPPED_MAX_BYTES = 8 * 1024 * 1024; // zip-bomba ellen
const OPTION_MAX_LEN = 80;
const HEADER_WORDS = new Set([
  'opció', 'opcio', 'opciók', 'opciok', 'lehetőség', 'lehetoseg', 'lehetőségek', 'lehetosegek', 'válasz', 'valasz', 'válaszok', 'valaszok',
  'név', 'nev', 'megnevezés', 'megnevezes', 'option', 'options', 'choice', 'choices', 'name', 'answer', 'answers', 'label',
]);

export class ImportError extends Error {
  constructor(public code: 'type' | 'size' | 'empty' | 'read') {
    super(code);
  }
}

export interface ImportResult {
  /** A betöltendő, megtisztított lehetőségek (üres és ismétlődő sorok nélkül, 80 karakterre vágva). */
  items: string[];
  /** Kihagyott üres vagy ismétlődő sorok száma. */
  skipped: number;
}

/** Cellaszövegek tisztítása: szóköz, ismétlődés (kis/nagybetű nélkül), hossz. */
export function cleanItems(raw: string[]): ImportResult {
  const seen = new Set<string>();
  const items: string[] = [];
  let skipped = 0;
  for (const r of raw) {
    const v = r.replace(/\s+/g, ' ').trim().slice(0, OPTION_MAX_LEN).trim();
    const key = v.toLowerCase();
    if (!v || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    items.push(v);
  }
  return { items, skipped };
}

function dropHeader(rows: string[]): string[] {
  return rows.length > 0 && HEADER_WORDS.has(rows[0].trim().toLowerCase()) ? rows.slice(1) : rows;
}

/** A leftmost nem üres oszlop celláinak kiválasztása a sorokból (üres sorok megmaradnak a sorrend miatt). */
function firstColumn(rows: string[][]): string[] {
  let col = -1;
  for (const r of rows) {
    r.forEach((c, i) => {
      if (c.trim() && (col === -1 || i < col)) col = i;
    });
  }
  return col === -1 ? [] : rows.map((r) => r[col] ?? '');
}

/** A bájtok dekódolása: UTF-8, ennek hibája esetén Windows-1250 (az Excel magyar CSV-je). */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1250').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

/** RFC 4180-szerű CSV-elemzés idézőjelekkel; a határoló (; , tab) automatikusan felismert. */
export function parseCsv(text: string): string[][] {
  const lines = splitRecords(text);
  const delim = detectDelimiter(lines);
  return lines.map((l) => splitFields(l, delim));
}

function splitRecords(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQ = !inQ;
      cur += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur !== '') out.push(cur);
  return out;
}

function countOutsideQuotes(line: string, d: string): number {
  let n = 0;
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === d && !inQ) n += 1;
  }
  return n;
}

/** Határoló: az a jel, amely minden nem üres sorban azonos (>0) számban fordul elő; különben egyoszlopos a fájl. */
function detectDelimiter(lines: string[]): string {
  const filled = lines.filter((l) => l.trim());
  for (const d of [';', '\t', ',']) {
    const counts = filled.map((l) => countOutsideQuotes(l, d));
    if (counts.length > 0 && counts[0] > 0 && counts.every((c) => c === counts[0])) return d;
  }
  return '\u0000';
}

function splitFields(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---------------- xlsx ----------------

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');
const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Az első munkalap celláinak sorai az xlsx (zip) fájlból. */
export async function parseXlsx(bytes: Uint8Array): Promise<string[][]> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(bytes, {
    filter: (f) => f.originalSize <= UNZIPPED_MAX_BYTES && /^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml))$/.test(f.name),
  });
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : '');

  // az első munkalap útvonala a workbook.xml-ből és a kapcsolatokból (alapértelmezés: sheet1.xml)
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(read('xl/workbook.xml'))?.[1];
  if (rid) {
    for (const m of read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
      if (new RegExp(`\\bId="${rid}"`).test(m[0])) {
        const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
        if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  const sheet = read(sheetPath);
  if (!sheet) throw new ImportError('read');

  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const idx = ref ? colIndex(ref) : row.length;
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = '';
      if (type === 's') val = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') val = textOf(body);
      else if (v !== undefined) val = unescapeXml(v);
      row[idx] = val;
    }
    rows.push(Array.from(row, (c) => c ?? ''));
  }
  return rows;
}

// ---------------- belépési pont ----------------

export async function parseOptionsFile(file: File): Promise<ImportResult> {
  if (file.size > IMPORT_MAX_BYTES) throw new ImportError('size');
  const name = file.name.toLowerCase();
  let rows: string[][];
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (name.endsWith('.xlsx')) rows = await parseXlsx(bytes);
    else if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv' || file.type === 'text/plain') rows = parseCsv(decodeText(bytes));
    else throw new ImportError('type');
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('read');
  }
  const col = dropHeader(firstColumn(rows));
  const { items, skipped } = cleanItems(col);
  if (items.length === 0) throw new ImportError('empty');
  return { items, skipped };
}

/** A lehetőségek mintafájlja (UTF-8 BOM-mal, hogy az Excel helyesen nyissa meg). */
export const SAMPLE_CSV = '﻿Lehetőség\r\nElső lehetőség\r\nMásodik lehetőség\r\nHarmadik lehetőség\r\n';
