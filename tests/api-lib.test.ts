import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLUG_ALPHABET,
  SLUG_LENGTH,
  generateSlug,
  generateToken,
  hashDevice,
  safeEqual,
  sha256Hex,
} from '../api/_lib/crypto.js';
import { effectiveStatus, isDeviceId, isSlug, validateCreate } from '../api/_lib/validate.js';

test('slug: hossz, ábécé, nincs félreérthető karakter, megfelel a DB megszorításnak', () => {
  for (let i = 0; i < 500; i++) {
    const s = generateSlug();
    assert.equal(s.length, SLUG_LENGTH);
    assert.match(s, /^[a-z0-9]{6}$/);
    assert.ok([...s].every((c) => SLUG_ALPHABET.includes(c)));
    assert.ok(!/[01oli]/.test(s));
  }
});

test('token: 32 bájt, url-barát, egyedi; a hash determinisztikus és 64 hex', () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sha256Hex(a), sha256Hex(a));
  assert.match(sha256Hex(a), /^[0-9a-f]{64}$/);
});

test('eszköz-hash: sótól és azonosítótól függ, a nyers azonosító nem szerepel benne', () => {
  const id = 'abcdefghijklmnopqrstuvwxyz012345';
  assert.equal(hashDevice(id, 's1'), hashDevice(id, 's1'));
  assert.notEqual(hashDevice(id, 's1'), hashDevice(id, 's2'));
  assert.notEqual(hashDevice(id, 's1'), hashDevice(id + 'x', 's1'));
  assert.ok(!hashDevice(id, 's1').includes(id));
});

test('safeEqual: egyező és eltérő, eltérő hosszú értékekre is', () => {
  assert.equal(safeEqual('titok', 'titok'), true);
  assert.equal(safeEqual('titok', 'Titok'), false);
  assert.equal(safeEqual('titok', 'titok-hosszabb'), false);
  assert.equal(safeEqual('', ''), true);
});

test('azonosító-ellenőrzők', () => {
  assert.equal(isSlug('k7m2xq'), true);
  assert.equal(isSlug('K7M2XQ'), false);
  assert.equal(isSlug('k7m2x'), false);
  assert.equal(isSlug(42), false);
  assert.equal(isDeviceId('a'.repeat(32)), true);
  assert.equal(isDeviceId('rövid'), false);
  assert.equal(isDeviceId('a'.repeat(65)), false);
  assert.equal(isDeviceId('a'.repeat(31) + '!'), false);
});

test('validateCreate: érvényes, kétnyelvű és egynyelvű szavazás', () => {
  const r = validateCreate({
    title: { hu: ' Kedvenc szín? ', en: 'Favourite colour?' },
    options: [{ hu: 'Kék', en: 'Blue' }, { hu: 'Piros' }, { en: 'Green' }],
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.title.hu, 'Kedvenc szín?');
    assert.deepEqual(r.value.options.map((o) => o.id), ['o1', 'o2', 'o3']);
    assert.equal(r.value.options[1].en, undefined);
  }
});

test('validateCreate: elutasítja a hibás bemenetet', () => {
  const opt = (n: number) => Array.from({ length: n }, (_, i) => ({ hu: `v${i}` }));
  assert.equal(validateCreate(null).ok, false);
  assert.equal(validateCreate({ title: {}, options: opt(2) }).ok, false);
  assert.equal(validateCreate({ title: { hu: 'x' }, options: opt(1) }).ok, false);
  assert.equal(validateCreate({ title: { hu: 'x' }, options: opt(11) }).ok, false);
  assert.equal(validateCreate({ title: { hu: 'x'.repeat(121) }, options: opt(2) }).ok, false);
  assert.equal(validateCreate({ title: { hu: 'x' }, options: [{ hu: 'a' }, {}] }).ok, false);
  assert.equal(validateCreate({ title: { hu: 'x' }, options: [{ hu: 'a' }, { hu: 5 }] }).ok, false);
  assert.equal(validateCreate({ title: { hu: 'x' }, options: opt(2) }).ok, true);
  assert.equal(validateCreate({ title: { hu: 'x' }, options: opt(10) }).ok, true);
});

test('effectiveStatus: állapot és időablak', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const base = { status: 'open', opens_at: null, closes_at: null };
  assert.equal(effectiveStatus(base, now), 'open');
  assert.equal(effectiveStatus({ ...base, status: 'closed' }, now), 'closed');
  assert.equal(effectiveStatus({ ...base, status: 'draft' }, now), 'upcoming');
  assert.equal(effectiveStatus({ ...base, opens_at: '2026-11-03T13:00:00Z' }, now), 'upcoming');
  assert.equal(effectiveStatus({ ...base, closes_at: '2026-11-03T11:00:00Z' }, now), 'closed');
  assert.equal(effectiveStatus({ ...base, opens_at: '2026-11-03T11:00:00Z', closes_at: '2026-11-03T13:00:00Z' }, now), 'open');
});
