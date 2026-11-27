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

// Összetett egyediség: szavazatonként egy eszköz (poll_id, device_hash).
const UNIQUE_COMPOSITE: Record<string, string[][]> = { votes: [['poll_id', 'device_hash']] };

// Az adatbázis oszlop-alapértékei.
const DEFAULTS: Record<string, Row> = { s2v_access_codes: { active: true, use_count: 0, last_used_at: null, expires_at: null, project_id: null } };

class Q implements PromiseLike<any> {
  private filters: Array<[string, unknown]> = [];
  private ranges: Array<[string, '>=' | '<=', string]> = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private max = Infinity;
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
  order(col?: string, o?: { ascending?: boolean }) {
    if (col) this.orderBy = { col, asc: o?.ascending !== false };
    return this;
  }
  gte(c: string, v: string) {
    this.ranges.push([c, '>=', v]);
    return this;
  }
  lte(c: string, v: string) {
    this.ranges.push([c, '<=', v]);
    return this;
  }
  limit(n: number) {
    this.max = n;
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
  /** Beszúrás vagy (ütközésnél) összefésülés / kihagyás az onConflict oszlopok szerint. */
  upsert(r: Row, o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    const rows = (this.tables[this.table] ??= []);
    const cols = (o?.onConflict ?? 'id').split(',');
    const existing = rows.find((x) => cols.every((c) => x[c] === r[c]));
    if (existing) {
      if (!o?.ignoreDuplicates) Object.assign(existing, r);
      return Promise.resolve({ data: null, error: null });
    }
    rows.push({ id: randomUUID(), ...r });
    return Promise.resolve({ data: null, error: null });
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
      for (const cols of UNIQUE_COMPOSITE[this.table] ?? []) {
        if (rows.some((r) => cols.every((c) => r[c] === this.patch[c]))) return { data: null, error: { code: '23505', message: 'duplicate' } };
      }
      const row = { id: randomUUID(), ...(DEFAULTS[this.table] ?? {}), ...(this.table === 's2v_audit_log' || this.table === 's2v_tech_errors' ? { at: new Date().toISOString() } : {}), ...this.patch };
      rows.push(row);
      return { data: single ? row : [row], error: null };
    }
    let match = rows.filter(
      (r) => this.filters.every(([c, v]) => r[c] === v) && this.ranges.every(([c, op, v]) => (op === '>=' ? String(r[c]) >= v : String(r[c]) <= v)),
    );
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      match = [...match].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
    }
    if (Number.isFinite(this.max)) match = match.slice(0, this.max);
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
    rpc: (name: string, args?: Row) => {
      if (name === 's2v_tech_hit' && args) {
        // percenként összegző növelés (mint az adatbázis-függvény)
        const rows = (tables.s2v_tech_hits ??= []);
        const bucket = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
        const key = args.p_slug ?? '';
        let r = rows.find((x) => x.bucket === bucket && x.poll_key === key && x.endpoint === args.p_endpoint && x.outcome === args.p_outcome);
        if (!r) rows.push((r = { bucket, poll_key: key, poll_id: args.p_poll_id ?? null, endpoint: args.p_endpoint, outcome: args.p_outcome, n: 0, ms_sum: 0, ms_max: 0 }));
        r.n += args.p_n;
        r.ms_sum += args.p_ms_sum;
        r.ms_max = Math.max(r.ms_max, args.p_ms_max);
        r.poll_id ??= args.p_poll_id ?? null;
        return Promise.resolve({ data: null, error: null });
      }
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
