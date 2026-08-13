import { describe, it, expect } from "vitest";
import {
  analyzeQuizIntegrity,
  MIN_ANSWER_MS,
  MEDIAN_FLOOR_MS,
} from "@/lib/quiz-integrity";

describe("quiz integrity guard", () => {
  it("does not flag a slow, legitimate perfect score", () => {
    const verdict = analyzeQuizIntegrity({
      totalMs: 60_000,
      answerTimesMs: [5000, 6000, 4000],
      pct: 100,
      totalQuestions: 3,
    });
    expect(verdict.flagged).toBe(false);
    expect(verdict.reasons).toEqual([]);
  });

  it("flags a perfect score answered implausibly fast in total", () => {
    const verdict = analyzeQuizIntegrity({
      totalMs: 2000,
      answerTimesMs: [6000, 6000, 6000], // generous per-question, but total is impossible
      pct: 100,
      totalQuestions: 3,
    });
    expect(verdict.flagged).toBe(true);
    expect(verdict.reasons.join(" ")).toContain("implausibly fast");
  });

  it("flags a perfect score with a fast median time", () => {
    const verdict = analyzeQuizIntegrity({
      totalMs: 12_000,
      answerTimesMs: [1200, 1300, 1400],
      pct: 100,
      totalQuestions: 3,
    });
    expect(verdict.flagged).toBe(true);
    expect(verdict.medianMs).toBeLessThan(MEDIAN_FLOOR_MS);
  });

  it("flags a mostly-instant answer pattern even without a perfect score", () => {
    const verdict = analyzeQuizIntegrity({
      totalMs: 30_000,
      answerTimesMs: [300, 300, 400, 9000],
      pct: 50,
      totalQuestions: 4,
    });
    expect(verdict.flagged).toBe(true);
    expect(verdict.fastCount).toBe(3);
    expect(verdict.fastRatio).toBe(0.75);
  });

  it("ignores skipped questions and a minority of fast answers", () => {
    const verdict = analyzeQuizIntegrity({
      totalMs: 20_000,
      answerTimesMs: [300, 5000, null, 6000],
      pct: 60,
      totalQuestions: 4,
    });
    expect(verdict.flagged).toBe(false);
    expect(verdict.fastRatio).toBe(1 / 3);
  });

  it("flags a perfect score with missing timing data", () => {
    // A client that omits timing cannot prove a legitimate pace.
    const verdict = analyzeQuizIntegrity({
      totalMs: 0,
      answerTimesMs: [],
      pct: 100,
      totalQuestions: 5,
    });
    expect(verdict.flagged).toBe(true);
  });

  it("treats negative/NaN times as skipped", () => {
    const verdict = analyzeQuizIntegrity({
      totalMs: 50_000,
      answerTimesMs: [-5, NaN, 4000],
      pct: 80,
      totalQuestions: 3,
    });
    expect(verdict.medianMs).toBe(4000);
    expect(verdict.flagged).toBe(false);
  });

  it("uses MIN_ANSWER_MS as the instant-answer floor", () => {
    expect(MIN_ANSWER_MS).toBe(800);
  });
});
