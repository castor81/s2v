import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchedule } from '../api/_lib/validate.js';
import { rankOptions } from '../src/lib/ranking.js';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const plus = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const DAY = 86_400_000;

test('időzítés: üres és hiányzó érték = azonnal nyit, kézi zárás', () => {
  for (const raw of [{}, { opensAt: null, closesAt: null }, { opensAt: '', closesAt: '' }]) {
    const r = validateSchedule(raw, NOW);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.value, { opensAt: null, closesAt: null });
  }
});

test('időzítés: hetekkel előre programozott nyitás és zárás érvényes', () => {
  const r = validateSchedule({ opensAt: plus(21 * DAY), closesAt: plus(21 * DAY + 3_600_000) }, NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.opensAt, plus(21 * DAY));
    assert.equal(r.value.closesAt, plus(21 * DAY + 3_600_000));
  }
});

test('időzítés: múltbeli nyitás = azonnal (null)', () => {
  const r = validateSchedule({ opensAt: plus(-DAY), closesAt: plus(DAY) }, NOW);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.opensAt, null);
});

test('időzítés: hibás esetek', () => {
  const err = (raw: Record<string, unknown>) => {
    const r = validateSchedule(raw, NOW);
    return r.ok ? 'ok' : r.error;
  };
  assert.equal(err({ closesAt: plus(-1000) }), 'closes_in_past');
  assert.equal(err({ opensAt: plus(DAY), closesAt: plus(DAY - 1000) }), 'window_too_short');
  assert.equal(err({ opensAt: plus(DAY), closesAt: plus(DAY + 30_000) }), 'window_too_short');
  assert.equal(err({ closesAt: plus(400 * DAY) }), 'closes_too_far');
  assert.equal(err({ opensAt: plus(400 * DAY) }), 'opens_too_far');
  assert.equal(err({ opensAt: 'holnap' }), 'opens_invalid_time');
  assert.equal(err({ closesAt: 12345 }), 'closes_invalid_time');
  assert.equal(err({ closesAt: '2026-13-99T99:99' }), 'closes_invalid_time');
});

test('rangsor: csökkenő szavazatszám, döntetlennél az eredeti sorrend, versenyrang', () => {
  const opts = [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }, { id: 'o4' }];
  const ranked = rankOptions(opts, { o1: 0, o2: 5, o3: 5, o4: 2 });
  assert.deepEqual(
    ranked.map((r) => [r.item.id, r.count, r.rank]),
    [
      ['o2', 5, 1],
      ['o3', 5, 1],
      ['o4', 2, 3],
      ['o1', 0, 4],
    ],
  );
});

test('rangsor: szavazat nélkül az eredeti sorrend marad, mindenki 1. helyen', () => {
  const ranked = rankOptions([{ id: 'o1' }, { id: 'o2' }], {});
  assert.deepEqual(ranked.map((r) => [r.item.id, r.rank]), [['o1', 1], ['o2', 1]]);
});
