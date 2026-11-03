import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, guard, send } from './_lib/http.js';
import { sha256Hex } from './_lib/crypto.js';
import { effectiveStatus, isToken, type PollOption } from './_lib/validate.js';
import { buildStats } from './_lib/stats.js';

const MAX_ROWS = 5000; // ≤300 egyidejű szavazónál bőven elég; a Supabase alapértelmezett lapméretét is felülírja

// POST /api/results  { token }
// A szervezői token alapján adja vissza a szavazást és az eredményeket (F7). A tokent a
// szerver csak hash-ként ismeri; érvénytelen token ugyanazt a 404-et kapja, mint a nem létező.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A dashboard 5 mp-enként frissít; a korlát magasabb, mert egy IP mögött több szervező is lehet.
  if (guard(req, res, 'results', 300)) return;

  try {
    const { token } = (req.body ?? {}) as Record<string, unknown>;
    if (!isToken(token)) return send(res, 400, { error: 'invalid_request' });

    const { data: poll, error } = await db()
      .from('polls')
      .select('id, slug, title, options, status, opens_at, closes_at, created_at, closed_at')
      .eq('organizer_token_hash', sha256Hex(token))
      .maybeSingle();
    if (error) {
      console.error('results: poll lookup failed', error.code, error.message);
      return send(res, 500, { error: 'server_error' });
    }
    if (!poll) return send(res, 404, { error: 'not_found' });

    const [votes, sessions] = await Promise.all([
      db().from('votes').select('option_id').eq('poll_id', poll.id).range(0, MAX_ROWS - 1),
      db().from('poll_sessions').select('first_seen_at, voted_at').eq('poll_id', poll.id).range(0, MAX_ROWS - 1),
    ]);
    if (votes.error || sessions.error) {
      console.error('results: stats query failed', votes.error?.code, sessions.error?.code);
      return send(res, 500, { error: 'server_error' });
    }

    const options = poll.options as PollOption[];
    const stats = buildStats(
      options.map((o) => o.id),
      votes.data ?? [],
      sessions.data ?? [],
    );
    const base = (process.env.BASE_URL ?? '').replace(/\/+$/, '');

    return send(res, 200, {
      slug: poll.slug,
      voteUrl: `${base}/${poll.slug}`,
      title: poll.title,
      options,
      status: effectiveStatus(poll),
      createdAt: poll.created_at,
      closedAt: poll.closed_at,
      stats,
    });
  } catch (e) {
    console.error('results failed', e);
    return send(res, 500, { error: 'server_error' });
  }
}
