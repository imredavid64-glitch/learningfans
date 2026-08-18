import { describe, it, expect } from "vitest";
import { trophiesFor, nextTrophy } from "@/lib/trophies";

const base = {
  total_xp: 0,
  current_streak: 0,
  longest_streak: 0,
  profileComplete: false,
  spaceCount: 0,
};

describe("trophies", () => {
  it("a fresh user has no trophies and a first nudge", () => {
    expect(trophiesFor(base)).toEqual([]);
    expect(nextTrophy(base)?.id).toBe("first-steps");
  });

  it("awards XP milestones cumulatively", () => {
    const earned = trophiesFor({ ...base, total_xp: 1_000 });
    const ids = earned.map((t) => t.id);
    expect(ids).toContain("first-steps");
    expect(ids).toContain("centurion");
    expect(ids).not.toContain("rising-star");
  });

  it("awards streak trophies (current for warm-up, longest for marathoner)", () => {
    expect(trophiesFor({ ...base, current_streak: 7 }).map((t) => t.id)).toContain("warm-up");
    expect(trophiesFor({ ...base, current_streak: 6, longest_streak: 30 }).map((t) => t.id)).toContain("marathoner");
    expect(trophiesFor({ ...base, current_streak: 6, longest_streak: 7 }).map((t) => t.id)).not.toContain("warm-up");
  });

  it("awards social trophies for profile + communities", () => {
    const ids = trophiesFor({ ...base, profileComplete: true, spaceCount: 4 }).map((t) => t.id);
    expect(ids).toContain("identity");
    expect(ids).toContain("joiner");
    expect(ids).toContain("community-builder");
  });

  it("nextTrophy returns null when everything is earned", () => {
    expect(
      nextTrophy({
        ...base,
        total_xp: 100_000,
        current_streak: 365,
        longest_streak: 365,
        profileComplete: true,
        spaceCount: 10,
      }),
    ).toBeNull();
  });
});