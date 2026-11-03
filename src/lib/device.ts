const KEY = 's2v_device';
let memoryId: string | undefined;

function randomId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url, 32 karakter: megfelel a szerver ^[A-Za-z0-9_-]{16,64}$ ellenőrzésének
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Véletlen eszközazonosító (nem személyes adat). Törlésével új azonosítót kap az eszköz,
 * ezért a duplikált szavazás ellen csak tét nélküli szavazásnál elég (K1).
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= randomId();
    return memoryId;
  }
}
