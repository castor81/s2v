// Az eredmények és a mérőszámok számítása tiszta függvényekben (egyszerűen tesztelhető).

export interface SessionRow {
  first_seen_at: string;
  voted_at: string | null;
}

export interface PollStats {
  /** Megnyitások (eszközök, amelyek nyitott szavazásnál betöltötték az oldalt). */
  sessions: number;
  /** Érvényes szavazatok száma. */
  votes: number;
  /** Leadási arány (0–1): a szavazott megnyitások aránya; null, ha nincs megnyitás. */
  completionRate: number | null;
  /** Az első megnyitástól a szavazatig eltelt idő mediánja másodpercben; null, ha nincs adat. */
  medianSecondsToVote: number | null;
  /** Szavazatok száma lehetőségenként (minden lehetőség szerepel, 0-val is). */
  counts: Record<string, number>;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function buildStats(
  optionIds: string[],
  votes: { option_id: string }[],
  sessions: SessionRow[],
): PollStats {
  const counts: Record<string, number> = {};
  for (const id of optionIds) counts[id] = 0;

  let total = 0;
  for (const v of votes) {
    if (Object.prototype.hasOwnProperty.call(counts, v.option_id)) {
      counts[v.option_id] += 1;
      total += 1;
    }
  }

  const voted = sessions.filter((s) => s.voted_at);
  const seconds = voted
    .map((s) => (Date.parse(s.voted_at as string) - Date.parse(s.first_seen_at)) / 1000)
    .filter((n) => Number.isFinite(n) && n >= 0);
  const med = median(seconds);

  return {
    sessions: sessions.length,
    votes: total,
    completionRate: sessions.length > 0 ? voted.length / sessions.length : null,
    medianSecondsToVote: med === null ? null : Math.round(med * 10) / 10,
    counts,
  };
}
