import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// Félreérthető karakterek (0/o, 1/l/i) nélkül; a DB-ben ^[a-z0-9]{6}$ a megszorítás.
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SLUG_LENGTH = 6;

// A slug nem ütközhet rendszerútvonalakkal (/uj, /o/, /api/ rövidebbek 6 karakternél,
// de a statikus mappa és a /master felület neve igen).
const RESERVED_SLUGS = new Set(['assets', 'master']);

export function generateSlug(): string {
  for (;;) {
    let slug = '';
    for (let i = 0; i < SLUG_LENGTH; i++) {
      slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
    }
    if (!RESERVED_SLUGS.has(slug)) return slug;
  }
}

/** 32 bájtos véletlen szervezői token (url-barát). Csak a hash-e kerül adatbázisba. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Az eszközazonosítót sósan hash-eljük; a nyers azonosító nem kerül adatbázisba. */
export function hashDevice(deviceId: string, salt: string): string {
  return sha256Hex(`${salt}:${deviceId}`);
}

/** Időzítés-biztos összehasonlítás (a hash-ek azonos hossza miatt mindig azonos hosszú bájtsorokat vet össze). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

// Szerkesztői kód: félreérthető karakterek nélkül, 3×4 jegy kötőjellel (kb. 58 bit).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateAccessCode(): string {
  const group = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}
