import { describe, it, expect } from "vitest";
import { rankThreads, hotScore, controversialScore, type RankableThread } from "@/lib/thread-ranking";

const NOW = new Date("2026-08-12T12:00:00Z").getTime();

function thread(overrides: Partial<RankableThread> & { id: string }): RankableThread {
  return {
    score: 0,
    ups: 0,
    downs: 0,
    is_pinned: false,
    created_at: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

describe("hotScore", () => {
  it("scores higher for recent, high-scored posts", () => {
    const freshHigh = hotScore(50, NOW - 60_000, NOW);
    const oldHigh = hotScore(50, NOW - 48 * 3_600_000, NOW);
    const freshLow = hotScore(5, NOW - 60_000, NOW);
    expect(freshHigh).toBeGreaterThan(oldHigh);
    expect(freshHigh).toBeGreaterThan(freshLow);
  });

  it("handles negative scores", () => {
    expect(hotScore(-10, NOW - 60_000, NOW)).toBeLessThan(0);
  });
});

describe("controversialScore", () => {
  it("ranks split votes with volume above small even votes", () => {
    expect(controversialScore(50, 50)).toBeGreaterThan(controversialScore(3, 3));
    expect(controversialScore(100, 100)).toBeGreaterThan(controversialScore(50, 50));
  });

  it("ranks balanced votes above lopsided ones", () => {
    expect(controversialScore(10, 10)).toBeGreaterThan(controversialScore(19, 1));
    expect(controversialScore(0, 5)).toBe(0);
  });
});

describe("rankThreads", () => {
  it("keeps pinned threads on top in every sort", () => {
    const oldPinned = thread({ id: "p1", is_pinned: true, score: 1, created_at: new Date(NOW - 3600_000).toISOString() });
    const freshUnpinned = thread({ id: "u1", score: 99, created_at: new Date(NOW - 60_000).toISOString() });
    for (const sort of ["hot", "new", "top", "controversial"] as const) {
      expect(rankThreads([freshUnpinned, oldPinned], sort, NOW).map((t) => t.id)).toEqual(["p1", "u1"]);
    }
  });

  it("new sorts by created_at descending", () => {
    const a = thread({ id: "old", created_at: new Date(NOW - 3600_000).toISOString() });
    const b = thread({ id: "new", created_at: new Date(NOW - 60_000).toISOString() });
    expect(rankThreads([a, b], "new", NOW).map((t) => t.id)).toEqual(["new", "old"]);
  });

  it("top sorts by score then recency", () => {
    const low = thread({ id: "low", score: 1, created_at: new Date(NOW - 60_000).toISOString() });
    const high = thread({ id: "high", score: 50, created_at: new Date(NOW - 3600_000).toISOString() });
    expect(rankThreads([low, high], "top", NOW).map((t) => t.id)).toEqual(["high", "low"]);
  });

  it("controversial puts split-vote posts first", () => {
    const split = thread({ id: "split", ups: 40, downs: 40, score: 0 });
    const lopsided = thread({ id: "lop", ups: 80, downs: 0, score: 80 });
    expect(rankThreads([lopsided, split], "controversial", NOW).map((t) => t.id)).toEqual(["split", "lop"]);
  });

  it("hot prefers a fresh high-score post over an old one", () => {
    const fresh = thread({ id: "fresh", score: 20, created_at: new Date(NOW - 60_000).toISOString() });
    const ancient = thread({ id: "ancient", score: 200, created_at: new Date(NOW - 30 * 24 * 3600_000).toISOString() });
    expect(rankThreads([ancient, fresh], "hot", NOW).map((t) => t.id)).toEqual(["fresh", "ancient"]);
  });
});
