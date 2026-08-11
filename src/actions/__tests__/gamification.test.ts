import { describe, expect, it } from "vitest";
import { xpToLevel, levelProgress } from "@/lib/gamification";

describe("gamification helpers", () => {
  it("xpToLevel maps XP to levels", () => {
    expect(xpToLevel(0)).toBe(1);
    expect(xpToLevel(50)).toBe(1);
    expect(xpToLevel(99)).toBe(1);
    expect(xpToLevel(100)).toBe(2);
    expect(xpToLevel(199)).toBe(2);
    expect(xpToLevel(250)).toBe(3);
    expect(xpToLevel(-10)).toBe(1);
  });

  it("levelProgress reports progress within the current level", () => {
    expect(levelProgress(0)).toEqual({ current: 0, next: 100, pct: 0 });
    expect(levelProgress(50)).toEqual({ current: 50, next: 100, pct: 50 });
    expect(levelProgress(99)).toEqual({ current: 99, next: 100, pct: 99 });
    expect(levelProgress(100)).toEqual({ current: 0, next: 100, pct: 0 });
    expect(levelProgress(250)).toEqual({ current: 50, next: 100, pct: 50 });
  });

  it("levelProgress handles negative XP defensively", () => {
    expect(levelProgress(-5)).toEqual({ current: -5, next: 100, pct: -5 });
  });
});
