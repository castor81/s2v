// Terheléspróba: 1 szavazás létrehozása, majd N virtuális szavazó (alapértelmezés: 300),
// akik egy időablakban (alapértelmezés: 60 mp) megnyitják az oldalt és szavaznak.
// Futtatás:  BASE_URL=https://s2vote.vercel.app GATE_CODE=... node scripts/loadtest.mjs [N] [ablak_mp]
// Fontos: egyetlen IP-ről fut; a szerver oldali IP-korlát (RATE_LIMIT_PER_MIN) alatt kell maradnia.
import { randomBytes } from 'node:crypto';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const GATE = process.env.GATE_CODE;
const N = Number(process.argv[2] ?? 300);
const WINDOW_S = Number(process.argv[3] ?? 60);

if (!GATE) {
  console.error('Hiányzik a GATE_CODE környezeti változó.');
  process.exit(1);
}

const post = async (path, body) => {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ms: performance.now() - t0 };
};

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

const created = await post('/api/create', {
  gateCode: GATE,
  title: { hu: 'Terheléspróba', en: 'Load test' },
  options: [{ hu: 'A', en: 'A' }, { hu: 'B', en: 'B' }, { hu: 'C', en: 'C' }],
});
if (created.status !== 201) {
  console.error('A szavazás létrehozása nem sikerült:', created.status, created.data);
  process.exit(1);
}
const slug = created.data.slug;
console.log(`Szavazás létrehozva: ${created.data.voteUrl} · ${N} szavazó ${WINDOW_S} mp alatt`);

const optionIds = ['o1', 'o2', 'o3'];
const openMs = [];
const voteMs = [];
const statuses = {};
const bump = (k) => (statuses[k] = (statuses[k] ?? 0) + 1);
const devices = Array.from({ length: N }, () => randomBytes(24).toString('base64url'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await Promise.all(
  devices.map(async (deviceId, i) => {
    await sleep((i / N) * WINDOW_S * 1000 * Math.random());
    const o = await post('/api/open', { slug, deviceId });
    openMs.push(o.ms);
    bump(`open:${o.status}`);
    await sleep(500 + Math.random() * 3000); // a szavazó gondolkodik
    const v = await post('/api/vote', { slug, deviceId, optionId: optionIds[i % 3] });
    voteMs.push(v.ms);
    bump(`vote:${v.status}`);
  }),
);

// Duplikált szavazat ellenőrzése: ugyanaz az eszköz másodszor már nem szavazhat.
const dup = await post('/api/vote', { slug, deviceId: devices[0], optionId: 'o1' });
console.log('\nÁllapotkódok:', statuses);
console.log(`open  p50=${pct(openMs, 50)} ms  p95=${pct(openMs, 95)} ms`);
console.log(`vote  p50=${pct(voteMs, 50)} ms  p95=${pct(voteMs, 95)} ms`);
console.log(`Duplikált szavazat elutasítva: ${dup.status === 409 && dup.data.error === 'already_voted' ? 'IGEN' : 'NEM (' + dup.status + ')'}`);

const okVotes = statuses['vote:200'] ?? 0;
const failed = N - okVotes;
console.log(`Sikeres szavazat: ${okVotes}/${N} (hibás: ${failed}, ${((failed / N) * 100).toFixed(1)}%)`);
console.log('Küszöb (jóváhagyott mérőszám): hibás/duplikált szavazat aránya ≤ 1%');
process.exit(failed / N <= 0.01 && dup.status === 409 ? 0 : 2);
