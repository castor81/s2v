import { db, requireEnv } from './http.js';
import { generateSlug, generateToken, sha256Hex } from './crypto.js';
import type { PollOption, Localized } from './validate.js';

export interface NewPoll {
  title: Localized;
  options: PollOption[];
  opensAt: string | null;
  closesAt: string | null;
  projectId: string | null;
  codeId: string | null;
}

export type Created =
  | { ok: true; slug: string; voteUrl: string; organizerUrl: string }
  | { ok: false; error: 'slug_collision' | 'server_error' };

/** Szavazás beszúrása új szervezői tokennel. A szervezői hivatkozás csak a visszatérési értékben él. */
export async function insertPoll(p: NewPoll): Promise<Created> {
  const baseUrl = requireEnv('BASE_URL').replace(/\/+$/, '');
  const token = generateToken();
  const tokenHash = sha256Hex(token);

  // A slug-ütközés (23505) elvileg ritka; néhányszor újrapróbáljuk.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const { error } = await db().from('polls').insert({
      slug,
      title: p.title,
      options: p.options,
      status: 'open',
      opens_at: p.opensAt,
      closes_at: p.closesAt,
      organizer_token_hash: tokenHash,
      project_id: p.projectId,
      code_id: p.codeId,
    });
    if (!error) {
      return { ok: true, slug, voteUrl: `${baseUrl}/${slug}`, organizerUrl: `${baseUrl}/o/${token}` };
    }
    if (error.code !== '23505') {
      console.error('create poll failed', error.code, error.message);
      return { ok: false, error: 'server_error' };
    }
  }
  return { ok: false, error: 'slug_collision' };
}
