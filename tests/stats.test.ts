import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStats, median } from '../api/_lib/stats.js';
import { isToken } from '../api/_lib/validate.js';
import { generateToken } from '../api/_lib/crypto.js';

test('median: üres, páratlan és páros elemszám', () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test('buildStats: lehetőségenkénti darabszám, 0-val is, ismeretlen opciót figyelmen kívül hagy', () => {
  const s = buildStats(
    ['o1', 'o2', 'o3'],
    [{ option_id: 'o1' }, { option_id: 'o1' }, { option_id: 'o3' }, { option_id: 'x9' }, { option_id: 'toString' }],
    [],
  );
  assert.deepEqual(s.counts, { o1: 2, o2: 0, o3: 1 });
  assert.equal(s.votes, 3);
  assert.equal(s.completionRate, null);
  assert.equal(s.medianSecondsToVote, null);
});

test('buildStats: leadási arány és idő a szavazatig', () => {
  const t0 = '2026-11-03T10:00:00.000Z';
  const s = buildStats(
    ['o1'],
    [],
    [
      { first_seen_at: t0, voted_at: '2026-11-03T10:00:10.000Z' }, // 10 mp
      { first_seen_at: t0, voted_at: '2026-11-03T10:00:30.000Z' }, // 30 mp
      { first_seen_at: t0, voted_at: '2026-11-03T10:00:20.000Z' }, // 20 mp
      { first_seen_at: t0, voted_at: null }, // nem szavazott
    ],
  );
  assert.equal(s.sessions, 4);
  assert.equal(s.completionRate, 0.75);
  assert.equal(s.medianSecondsToVote, 20);
});

test('buildStats: érvénytelen (negatív) időkülönbséget nem számol a mediánba', () => {
  const s = buildStats(
    ['o1'],
    [],
    [
      { first_seen_at: '2026-11-03T10:00:10.000Z', voted_at: '2026-11-03T10:00:00.000Z' },
      { first_seen_at: '2026-11-03T10:00:00.000Z', voted_at: '2026-11-03T10:00:08.000Z' },
    ],
  );
  assert.equal(s.medianSecondsToVote, 8);
  assert.equal(s.completionRate, 1);
});

test('isToken: a generált token érvényes, a rövid vagy idegen karaktert tartalmazó nem', () => {
  assert.equal(isToken(generateToken()), true);
  assert.equal(isToken('rövid'), false);
  assert.equal(isToken('a'.repeat(43)), true);
  assert.equal(isToken('a'.repeat(42) + '!'), false);
  assert.equal(isToken(undefined), false);
});
