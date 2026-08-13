import { describe, it, expect } from "vitest";
import {
  weekStart,
  checkedInSince,
  groupStreak,
  weeklyProgress,
  type GroupCheckin,
} from "@/lib/accountability";

function day(offsetFromToday: number): string {
  const d = new Date("2026-08-13T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetFromToday);
  return d.toISOString().slice(0, 10);
}

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    // 2026-08-13 is a Thursday; the week's Monday is 2026-08-10.
    const monday = weekStart(new Date("2026-08-13T12:00:00Z"));
    expect(monday.toISOString().slice(0, 10)).toBe("2026-08-10");
  });

  it("treats Sunday as the end of the week (Monday of the previous week)", () => {
    // 2026-08-16 is a Sunday; Monday is 2026-08-10.
    const monday = weekStart(new Date("2026-08-16T00:00:00Z"));
    expect(monday.toISOString().slice(0, 10)).toBe("2026-08-10");
  });
});

describe("checkedInSince", () => {
  it("returns members checked in on or after the week start", () => {
    const checkins: GroupCheckin[] = [
      { user_id: "a", checkin_date: day(0) },
      { user_id: "b", checkin_date: day(-10) }, // too old
      { user_id: "c", checkin_date: day(-1) },
    ];
    const start = weekStart(new Date("2026-08-13T12:00:00Z"));
    const out = checkedInSince(["a", "b", "c"], checkins, start);
    expect(out.has("a")).toBe(true);
    expect(out.has("b")).toBe(false);
    expect(out.has("c")).toBe(true);
  });

  it("ignores non-members", () => {
    const checkins: GroupCheckin[] = [{ user_id: "outsider", checkin_date: day(0) }];
    expect(checkedInSince(["a"], checkins, new Date("2026-08-13T12:00:00Z")).size).toBe(0);
  });
});

describe("groupStreak", () => {
  const now = new Date("2026-08-13T12:00:00Z");

  it("counts consecutive all-member days ending today", () => {
    const checkins: GroupCheckin[] = [
      { user_id: "a", checkin_date: day(0) },
      { user_id: "b", checkin_date: day(0) },
      { user_id: "a", checkin_date: day(-1) },
      { user_id: "b", checkin_date: day(-1) },
      { user_id: "a", checkin_date: day(-2) },
      { user_id: "b", checkin_date: day(-2) },
    ];
    expect(groupStreak(["a", "b"], checkins, now)).toBe(3);
  });

  it("treats today as in-progress (doesn't break the streak)", () => {
    const checkins: GroupCheckin[] = [
      { user_id: "a", checkin_date: day(-1) },
      { user_id: "b", checkin_date: day(-1) },
      { user_id: "a", checkin_date: day(-2) },
      { user_id: "b", checkin_date: day(-2) },
      // today only a checked in — the streak should still count yesterday + day-before.
    ];
    expect(groupStreak(["a", "b"], checkins, now)).toBe(2);
  });

  it("returns 0 for an empty group or no shared days", () => {
    expect(groupStreak([], [], now)).toBe(0);
    expect(groupStreak(["a", "b"], [], now)).toBe(0);
  });
});

describe("weeklyProgress", () => {
  const now = new Date("2026-08-13T12:00:00Z");

  it("returns the fraction of members checked in this week", () => {
    const checkins: GroupCheckin[] = [{ user_id: "a", checkin_date: day(0) }];
    expect(weeklyProgress(["a", "b"], checkins, now)).toBe(0.5);
    expect(weeklyProgress(["a"], checkins, now)).toBe(1);
    expect(weeklyProgress(["b"], checkins, now)).toBe(0);
  });
});
