export interface RankedRow<T> {
  item: T;
  count: number;
  /** Versenyrangsor: azonos szavazatszámnál azonos hely (1, 1, 3, ...). */
  rank: number;
}

/**
 * A lehetőségek csökkenő szavazatszám szerinti sorrendben. Azonos szavazatszámnál az eredeti
 * (megadási) sorrend marad, így a lista nem "ugrál" döntetlennél.
 */
export function rankOptions<T extends { id: string }>(options: T[], counts: Record<string, number>): RankedRow<T>[] {
  const rows = options.map((item, index) => ({ item, index, count: counts[item.id] ?? 0 }));
  rows.sort((a, b) => b.count - a.count || a.index - b.index);
  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.count !== prev) rank = i + 1;
    prev = r.count;
    return { item: r.item, count: r.count, rank };
  });
}
