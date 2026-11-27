import { db } from './http.js';
import type { Localized } from './validate.js';

// Tevékenységnapló (s2v_audit_log). A naplózás nem akadályozhatja a műveletet: hiba esetén csak naplózzuk a hibát.
// A kódok értéke soha nem kerül a naplóba, csak a megnevezésük.

export type ActorRole = 'master' | 'director' | 'editor' | 'organizer';

export interface AuditEntry {
  actorRole: ActorRole;
  /** Szerkesztői kód megnevezése (editor/organizer); master/direktor esetén üres. */
  actorLabel?: string | null;
  codeId?: string | null;
  action: string;
  projectId?: string | null;
  projectName?: string | null;
  pollId?: string | null;
  pollSlug?: string | null;
  pollTitle?: string | null;
  detail?: Record<string, unknown> | null;
}

export const titleText = (t: Localized | null | undefined): string | null => (t ? (t.hu ?? t.en ?? null) : null);

export async function audit(entries: AuditEntry | AuditEntry[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  for (const e of list) {
    try {
      const { error } = await db().from('s2v_audit_log').insert({
        actor_role: e.actorRole,
        actor_label: e.actorLabel ?? null,
        code_id: e.codeId ?? null,
        action: e.action,
        project_id: e.projectId ?? null,
        project_name: e.projectName ?? null,
        poll_id: e.pollId ?? null,
        poll_slug: e.pollSlug ?? null,
        poll_title: e.pollTitle ?? null,
        detail: e.detail ?? null,
      });
      if (error) console.error('audit insert failed', error.code, error.message);
    } catch (err) {
      console.error('audit failed', err);
    }
  }
}

/** A szervezői linkkel végzett művelet naplóbejegyzése: a szavazás kódjából és projektjéből a szerkesztői kód megnevezése. */
export async function auditOrganizer(
  poll: { id: string; slug?: string; title?: Localized; code_id?: string | null; project_id?: string | null },
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    let label: string | null = null;
    let projectName: string | null = null;
    if (poll.code_id) {
      const { data } = await db().from('s2v_access_codes').select('label').eq('id', poll.code_id).maybeSingle();
      label = data?.label ?? null;
    }
    if (poll.project_id) {
      const { data } = await db().from('s2v_projects').select('name').eq('id', poll.project_id).maybeSingle();
      projectName = data?.name ?? null;
    }
    await audit({
      actorRole: 'organizer',
      actorLabel: label,
      codeId: poll.code_id ?? null,
      action,
      projectId: poll.project_id ?? null,
      projectName,
      pollId: poll.id,
      pollSlug: poll.slug ?? null,
      pollTitle: titleText(poll.title),
      detail: detail ?? null,
    });
  } catch (err) {
    console.error('audit organizer failed', err);
  }
}
