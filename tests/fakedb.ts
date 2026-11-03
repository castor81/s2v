import { randomUUID } from 'node:crypto';
// Hamis (memóriabeli) Supabase-kliens a végpont-tesztekhez: a valódi kezelők futnak, csak a kliens cserélt.
export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

// Egyediségi megszorítások (a valódi séma UNIQUE-jai), 23505 hibakóddal.
const UNIQUE: Record<string, string[]> = {
  polls: ['slug', 'organizer_token_hash'],
  s2v_access_codes: ['code_hash'],
  s2v_projects: ['name'],
};

// Az adatbázis oszlop-alapértékei.
const DEFAULTS: Record<string, Row> = { s2v_access_codes: { active: true, use_count: 0, last_used_at: null, expires_at: null, project_id: null } };

class Q implements PromiseLike<any> {
  private filters: Array<[string, unknown]> = [];
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private patch: Row = {};
  private count = false;
  private head = false;
  constructor(private tables: Tables, private table: string) {}
  select(_cols?: string, o?: { count?: string; head?: boolean }) {
    this.count = Boolean(o?.count);
    this.head = Boolean(o?.head);
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  update(p: Row) {
    this.op = 'update';
    this.patch = p;
    return this;
  }
  insert(r: Row) {
    this.op = 'insert';
    this.patch = r;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run(true));
  }
  single() {
    return Promise.resolve(this.run(true));
  }
  then(a?: any, b?: any): any {
    return Promise.resolve(this.run(false)).then(a, b);
  }
  private run(single: boolean) {
    const rows = (this.tables[this.table] ??= []);
    if (this.op === 'insert') {
      for (const col of UNIQUE[this.table] ?? []) {
        const dup = rows.some((r) =>
          typeof r[col] === 'string' && typeof this.patch[col] === 'string'
            ? col === 'name'
              ? r[col].toLowerCase() === this.patch[col].toLowerCase()
              : r[col] === this.patch[col]
            : false,
        );
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate' } };
      }
      const row = { id: randomUUID(), ...(DEFAULTS[this.table] ?? {}), ...this.patch };
      rows.push(row);
      return { data: single ? row : [row], error: null };
    }
    const match = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
    if (this.op === 'update') {
      for (const col of UNIQUE[this.table] ?? []) {
        if (typeof this.patch[col] === 'string') {
          const clash = rows.some((r) => !match.includes(r) && String(r[col]).toLowerCase() === this.patch[col].toLowerCase());
          if (clash) return { data: null, error: { code: '23505', message: 'duplicate' } };
        }
      }
      match.forEach((r) => Object.assign(r, this.patch));
    }
    if (this.op === 'delete') {
      this.tables[this.table] = rows.filter((r) => !match.includes(r));
      // kaszkád: a szavazás törlése viszi a szavazatait és munkameneteit is
      if (this.table === 'polls') {
        const gone = new Set(match.map((r) => r.id));
        for (const t of ['votes', 'poll_sessions']) {
          this.tables[t] = (this.tables[t] ?? []).filter((r) => !gone.has(r.poll_id));
        }
      }
      return { data: null, error: null };
    }
    if (this.count && this.head) return { data: null, error: null, count: match.length };
    return { data: single ? (match[0] ?? null) : match, error: null };
  }
}

export function makeFakeDb(tables: Tables) {
  return {
    from: (t: string) => new Q(tables, t),
    // master_poll_counts(): szavazásonként szavazat, munkamenet és opciónkénti bontás
    rpc: (name: string) => {
      if (name !== 'master_poll_counts') return Promise.resolve({ data: null, error: { code: 'x', message: 'unknown rpc' } });
      const data = (tables.polls ?? []).map((p) => {
        const votes = (tables.votes ?? []).filter((v) => v.poll_id === p.id);
        const counts: Record<string, number> = {};
        for (const v of votes) counts[v.option_id] = (counts[v.option_id] ?? 0) + 1;
        return {
          poll_id: p.id,
          votes: votes.length,
          sessions: (tables.poll_sessions ?? []).filter((s) => s.poll_id === p.id).length,
          counts,
        };
      });
      return Promise.resolve({ data, error: null });
    },
  };
}

export async function call(handler: (req: any, res: any) => unknown, body: unknown, ip = '10.0.0.1') {
  const res: any = {
    code: 0,
    body: undefined,
    status(c: number) {
      this.code = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
    setHeader() {},
  };
  await handler({ method: 'POST', body, headers: {}, socket: { remoteAddress: ip } }, res);
  return res as { code: number; body: any };
}
