import { describe, it, expect } from "vitest";
import { computeNextReview, type CardProgressState } from "@/lib/srs";

const fresh: CardProgressState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, status: "new" };

describe("computeNextReview (SM-2)", () => {
  it("again resets to learning and reschedules within minutes", () => {
    const next = computeNextReview("again", fresh);
    expect(next.status).toBe("learning");
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(0);
    expect(next.easeFactor).toBe(2.3);
    const ms = new Date(next.dueAt).getTime() - Date.now();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(60 * 60 * 1000); // within the hour
  });

  it("good schedules day 1, then day 6, then grows by ease", () => {
    const d1 = computeNextReview("good", fresh);
    expect(d1.intervalDays).toBe(1);
    expect(d1.repetitions).toBe(1);
    expect(d1.status).toBe("review");

    const d6 = computeNextReview("good", d1);
    expect(d6.intervalDays).toBe(6);
    expect(d6.repetitions).toBe(2);

    const dMore = computeNextReview("good", d6);
    expect(dMore.intervalDays).toBe(Math.round(6 * d6.easeFactor));
    expect(dMore.repetitions).toBe(3);
  });

  it("easy schedules faster intervals and raises ease", () => {
    const next = computeNextReview("easy", fresh);
    expect(next.intervalDays).toBe(4);
    expect(next.easeFactor).toBe(2.6);
  });

  it("hard schedules one day and lowers ease", () => {
    const next = computeNextReview("hard", fresh);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBe(2.35);
  });

  it("ease factor never drops below 1.3", () => {
    let state = fresh;
    for (let i = 0; i < 10; i++) {
      state = computeNextReview("again", state);
    }
    expect(state.easeFactor).toBe(1.3);
  });

  it("marks cards mastered after five consecutive good reviews", () => {
    let state = fresh;
    for (let i = 0; i < 5; i++) {
      state = computeNextReview("good", state);
    }
    expect(state.status).toBe("mastered");
  });

  it("a miss after mastery resets to learning", () => {
    let state = fresh;
    for (let i = 0; i < 5; i++) {
      state = computeNextReview("good", state);
    }
    expect(state.status).toBe("mastered");
    const missed = computeNextReview("again", state);
    expect(missed.status).toBe("learning");
    expect(missed.repetitions).toBe(0);
  });
});
