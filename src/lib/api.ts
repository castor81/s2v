export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { error: string };
}

export async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({ error: 'bad_response' }))) as T | { error: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'network' } };
  }
}

export function errorCode(r: ApiResult<unknown>): string {
  const d = r.data as { error?: string } | null;
  return d?.error ?? 'unknown';
}
