// Lehetőségek importja: CSV/TXT és xlsx elemzés, tisztítás.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanItems, decodeText, parseCsv, parseOptionsFile, parseXlsx } from '../src/lib/importOptions.js';

const fileOf = (name: string, bytes: Uint8Array | string, type = '') => {
  const buf = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return { name, size: buf.length, type, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) } as unknown as File;
};

test('csv: pontosvessző, vessző és tab határoló; idézőjeles mező; fejléc kihagyva', async () => {
  const semi = await parseOptionsFile(fileOf('a.csv', 'Lehetőség;Megjegyzés\r\nAlfa;x\r\n"Béta; Gamma";y\r\nDelta;z\r\n'));
  assert.deepEqual(semi.items, ['Alfa', 'Béta; Gamma', 'Delta']);
  const comma = await parseOptionsFile(fileOf('a.csv', 'Option,Note\n"Egy, kettő",1\nHárom,2\n'));
  assert.deepEqual(comma.items, ['Egy, kettő', 'Három']);
  const tab = await parseOptionsFile(fileOf('a.txt', 'Alfa\t1\nBéta\t2\n'));
  assert.deepEqual(tab.items, ['Alfa', 'Béta']);
});

test('csv: egyoszlopos fájl, amelyben egyes sorokban vessző van, nem darabolódik', async () => {
  const r = await parseOptionsFile(fileOf('a.csv', 'Alfa, a nagy\nBéta\nGamma\n'));
  assert.deepEqual(r.items, ['Alfa, a nagy', 'Béta', 'Gamma']);
});

test('csv: Windows-1250 kódolás és UTF-8 BOM', () => {
  // "Őrség;Ágoston" cp1250: Ő=0xD5, é=0xE9, Á=0xC1
  const cp = new Uint8Array([0xd5, 0x72, 0x73, 0xe9, 0x67, 0x0a, 0xc1, 0x67, 0x6f, 0x73, 0x74, 0x6f, 0x6e]);
  assert.deepEqual(parseCsv(decodeText(cp)).map((r) => r[0]), ['Őrség', 'Ágoston']);
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), 'A');
});

test('tisztítás: szóköz, üres és ismétlődő sor (kis/nagybetű nélkül), 80 karakterre vágás', () => {
  const r = cleanItems(['  Alfa  ', 'alfa', '', '   ', 'Béta', 'x'.repeat(100)]);
  assert.deepEqual(r.items, ['Alfa', 'Béta', 'x'.repeat(80)]);
  assert.equal(r.skipped, 3);
});

test('xlsx: első munkalap, megosztott szövegek, entitások, szám, üres sor; második oszlop és lap figyelmen kívül', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/opciok.xlsx', import.meta.url)));
  const rows = await parseXlsx(bytes);
  assert.equal(rows[0][0], 'Lehetőség');
  const r = await parseOptionsFile(fileOf('opciok.xlsx', bytes));
  assert.deepEqual(r.items, ['Alfa csapat', 'Béta & Gamma', 'Őrség', 'Zoltán <jelölt>', '42']);
  assert.equal(r.skipped, 2); // az ismétlődő és az üres sor
});

test('xlsx: a legbaloldalibb kitöltött oszlop kerül felhasználásra', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/opciok-c-oszlop.xlsx', import.meta.url)));
  assert.deepEqual((await parseOptionsFile(fileOf('x.xlsx', bytes))).items, ['Első', 'Második', 'Harmadik']);
});

test('hibák: típus, méret, üres, sérült xlsx', async () => {
  await assert.rejects(parseOptionsFile(fileOf('a.xls', 'x')), { code: 'type' });
  await assert.rejects(parseOptionsFile({ name: 'a.csv', size: 3 * 1024 * 1024, type: '', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File), { code: 'size' });
  await assert.rejects(parseOptionsFile(fileOf('a.csv', '\n\n')), { code: 'empty' });
  await assert.rejects(parseOptionsFile(fileOf('a.xlsx', 'nem zip')), { code: 'read' });
});
