import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Hiányzó környezeti változó: ${name}`);
  return v;
}

let client: SupabaseClient | undefined;
/** Csak a háttér használja a service role kulcsot; a kliens soha nem látja. */
export function db(): SupabaseClient {
  client ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function send(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

// Egyszerű, példányonkénti (in-memory) sebességkorlát. Szerver nélküli környezetben a példányok
// nem osztoznak az állapoton, ezért ez csak visszaélés elleni alapvédelem, nem pontos kvóta.
// Rendezvényen sok szavazó lehet ugyanazon a wifi-IP mögött, ezért az alapérték magas.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(req: VercelRequest, scope: string, limitPerMin?: number): boolean {
  const limit = limitPerMin ?? Number(process.env.RATE_LIMIT_PER_MIN ?? 600);
  const key = `${scope}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

/** Közös előfeltételek: csak POST, sebességkorlát. Igaz, ha a kérést már lezártuk. */
export function guard(req: VercelRequest, res: VercelResponse, scope: string, limit?: number): boolean {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method_not_allowed' });
    return true;
  }
  if (rateLimited(req, scope, limit)) {
    res.setHeader('Retry-After', '60');
    send(res, 429, { error: 'rate_limited' });
    return true;
  }
  return false;
}
