import { db } from './http.js';
import { audit, titleText, type ActorRole, type AuditEntry } from './audit.js';

// A master/direktor műveletek naplózása. A művelet előtt pillanatfelvétel készül az érintett elemről
// (törlés után már nem olvasható), a művelet után a bejegyzések (egy kérésből akár több is) kerülnek a naplóba.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

type Body = Record<string, unknown>;
interface PollSnap {
  id: string;
  slug: string;
  title: { hu?: string; en?: string };
  project_id: string | null;
}
export interface Pre {
  poll?: PollSnap | null;
  project?: { id: string; name: string } | null;
  code?: { id: string; label: string; project_id: string | null } | null;
}

export const LOGGED_ACTIONS = new Set([
  'poll.create',
  'poll.update',
  'poll.meta',
  'poll.status',
  'poll.delete',
  'poll.copy',
  'poll.newToken',
  'project.create',
  'project.rename',
  'project.delete',
  'code.create',
  'code.update',
  'code.delete',
]);

async function projectName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const { data } = await db().from('s2v_projects').select('name').eq('id', id).maybeSingle();
  return data?.name ?? null;
}

/** Az érintett elem állapota a művelet előtt (csak olvasás; hiba esetén üres). */
export async function preContext(action: string, body: Body): Promise<Pre> {
  const pre: Pre = {};
  try {
    if (!isUuid(body.id)) return pre;
    if (action.startsWith('poll.') && action !== 'poll.create') {
      const { data } = await db().from('polls').select('id, slug, title, project_id').eq('id', body.id).maybeSingle();
      pre.poll = (data as PollSnap | null) ?? null;
    } else if (action.startsWith('project.') && action !== 'project.create') {
      const { data } = await db().from('s2v_projects').select('id, name').eq('id', body.id).maybeSingle();
      pre.project = data ?? null;
    } else if (action.startsWith('code.') && action !== 'code.create') {
      const { data } = await db().from('s2v_access_codes').select('id, label, project_id').eq('id', body.id).maybeSingle();
      pre.code = data ?? null;
    }
  } catch (e) {
    console.error('audit pre-context failed', e);
  }
  return pre;
}

const POLL_FIELDS = ['title', 'options', 'opensAt', 'closesAt'];

/** A művelet naplóbejegyzései (a sikeres válasz alapján). */
export async function logMasterAction(role: ActorRole, action: string, body: Body, pre: Pre, reply: unknown): Promise<void> {
  try {
    const r = (reply ?? {}) as Record<string, unknown>;
    const base = { actorRole: role } as const;
    const entries: AuditEntry[] = [];

    if (action.startsWith('poll.')) {
      let snap: PollSnap | null | undefined = pre.poll;
      const detail: Record<string, unknown> = {};
      if (action === 'poll.create' || action === 'poll.copy') {
        const slug = typeof r.slug === 'string' ? r.slug : null;
        if (slug) {
          const { data } = await db().from('polls').select('id, slug, title, project_id').eq('slug', slug).maybeSingle();
          if (action === 'poll.copy') detail.copiedFrom = pre.poll?.slug ?? null;
          snap = (data as PollSnap | null) ?? null;
        }
      }
      let projId = snap?.project_id ?? null;
      const mk = (a: string, d?: Record<string, unknown>): AuditEntry => ({
        ...base,
        action: a,
        pollId: snap?.id ?? null,
        pollSlug: snap?.slug ?? null,
        pollTitle: titleText(snap?.title),
        detail: d ?? null,
      });
      const withProject = async (e: AuditEntry, id: string | null): Promise<AuditEntry> => ({ ...e, projectId: id, projectName: await projectName(id) });

      if (action === 'poll.status') {
        entries.push(await withProject(mk(body.to === 'close' ? 'poll.close' : 'poll.reopen'), projId));
      } else if (action === 'poll.meta') {
        if ('projectId' in body) {
          projId = (body.projectId as string | null) ?? null;
          entries.push(await withProject(mk('poll.move', { fromProject: await projectName(pre.poll?.project_id) }), projId));
        }
        if ('archived' in body) entries.push(await withProject(mk(body.archived ? 'poll.archive' : 'poll.unarchive'), projId));
      } else if (action === 'poll.update') {
        entries.push(await withProject(mk('poll.update', { fields: POLL_FIELDS.filter((k) => k in body) }), projId));
      } else {
        entries.push(await withProject(mk(action, Object.keys(detail).length ? detail : undefined), projId));
      }
    } else if (action.startsWith('project.')) {
      const id = typeof r.id === 'string' ? r.id : (pre.project?.id ?? (isUuid(body.id) ? body.id : null));
      const name = action === 'project.create' ? String(body.name ?? '').trim() : (pre.project?.name ?? null);
      entries.push({
        ...base,
        action,
        projectId: id,
        projectName: name,
        detail: action === 'project.rename' ? { to: String(body.name ?? '').trim() } : null,
      });
    } else if (action.startsWith('code.')) {
      const label = action === 'code.create' ? String(body.label ?? '').trim() : (pre.code?.label ?? null);
      const pid = action === 'code.create' ? ((body.projectId as string | null) ?? null) : 'projectId' in body ? ((body.projectId as string | null) ?? null) : (pre.code?.project_id ?? null);
      const pname = await projectName(pid);
      const mk = (a: string, d?: Record<string, unknown>): AuditEntry => ({
        ...base,
        action: a,
        projectId: pid,
        projectName: pname,
        detail: { code: label, ...(d ?? {}) },
      });
      if (action === 'code.update') {
        if ('active' in body) entries.push(mk(body.active ? 'code.enable' : 'code.disable'));
        const fields = ['label', 'projectId', 'expiresAt'].filter((k) => k in body);
        if (fields.length) entries.push(mk('code.update', { fields }));
      } else {
        entries.push(mk(action, action === 'code.create' ? { expiresAt: body.expiresAt ?? null } : undefined));
      }
    }
    if (entries.length) await audit(entries);
  } catch (e) {
    console.error('master audit failed', e);
  }
}
