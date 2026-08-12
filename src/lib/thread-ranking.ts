// Reddit-style ranking for the community feed. Pure + unit-tested.

export type ThreadSort = "hot" | "new" | "top" | "controversial";

export type VoteValue = 1 | -1 | 0;

export interface RankableThread {
  id: string;
  score: number;
  ups: number;
  downs: number;
  is_pinned: boolean;
  created_at: string;
}

/** Reddit hot: decayed score — score / (hours + 2)^1.5, pinned excluded below. */
export function hotScore(score: number, createdAtMs: number, nowMs: number): number {
  const hours = Math.max(0, (nowMs - createdAtMs) / 3_600_000);
  return score / Math.pow(hours + 2, 1.5);
}

/**
 * Controversiality: high when votes are numerous AND split. Uses the smaller
 * side of the vote (min(ups, downs)) scaled by total votes so 50/50 with lots
 * of votes ranks above 3/3.
 */
export function controversialScore(ups: number, downs: number): number {
  const total = ups + downs;
  return Math.min(ups, downs) * (1 + total / 1000);
}

/**
 * Sort threads for the community feed. Pinned threads always stay on top
 * (Reddit stickies), then the selected sort applies.
 */
export function rankThreads<T extends RankableThread>(
  threads: T[],
  sort: ThreadSort,
  nowMs = Date.now(),
): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const t of threads) {
    (t.is_pinned ? pinned : rest).push(t);
  }

  const sortRest = (a: T, b: T): number => {
    const createdA = new Date(a.created_at).getTime();
    const createdB = new Date(b.created_at).getTime();
    switch (sort) {
      case "new":
        return createdB - createdA;
      case "top":
        return b.score - a.score || createdB - createdA;
      case "controversial":
        return (
          controversialScore(b.ups, b.downs) - controversialScore(a.ups, a.downs) ||
          b.score - a.score
        );
      case "hot":
      default:
        return (
          hotScore(b.score, createdB, nowMs) - hotScore(a.score, createdA, nowMs) ||
          createdB - createdA
        );
    }
  };

  return [...pinned.sort(sortRest), ...rest.sort(sortRest)];
}
