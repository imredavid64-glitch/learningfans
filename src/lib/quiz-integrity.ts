// Quiz integrity / cheating guard — pure, testable heuristics for flagging
// suspiciously-fast submissions so the leaderboard stays honest.
//
// The client sends a per-question "answer-time fingerprint" (latency from when
// each question was first shown to when it was first answered, plus the total
// elapsed time). The server re-derives the verdict — never trusts the client.

/** A single question answered faster than this is implausible (sub-human). */
export const MIN_ANSWER_MS = 800;

/** Median per-question time below this on a perfect score is suspicious. */
export const MEDIAN_FLOOR_MS = 1500;

/** More than this fraction of questions answered instantly = suspicious. */
export const FAST_RATIO_THRESHOLD = 0.5;

/** Absolute floor on total time before a perfect score is even plausible. */
export const MIN_TOTAL_PERFECT_MS = 10_000;

export interface QuizIntegrityInput {
  /** Wall-clock ms from quiz start to submit. */
  totalMs: number;
  /** Latency (ms) per question from first shown to first answered; null = skipped. */
  answerTimesMs: (number | null)[];
  /** Final score percent (0-100). */
  pct: number;
  /** Number of questions in the quiz. */
  totalQuestions: number;
}

export interface QuizIntegrityVerdict {
  flagged: boolean;
  reasons: string[];
  medianMs: number | null;
  fastCount: number;
  fastRatio: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Flag attempts whose timing fingerprints suggest a script/bot rather than a
 * student reading and answering. The verdict is advisory: a flagged attempt
 * doesn't update the leaderboard best score and earns no XP, but the student
 * still sees their score and can retake at a normal pace.
 */
export function analyzeQuizIntegrity(input: QuizIntegrityInput): QuizIntegrityVerdict {
  const times = (input.answerTimesMs ?? []).map((t) =>
    typeof t === "number" && Number.isFinite(t) && t >= 0 ? t : null,
  );
  const answered = times.filter((t): t is number => t !== null);
  const fastCount = answered.filter((t) => t < MIN_ANSWER_MS).length;
  const fastRatio = answered.length === 0 ? 0 : fastCount / answered.length;
  const medianMs = answered.length === 0 ? null : median(answered);
  const reasons: string[] = [];

  const totalMs = typeof input.totalMs === "number" && Number.isFinite(input.totalMs) && input.totalMs >= 0
    ? input.totalMs
    : 0;
  const perfect = input.pct >= 100;

  if (perfect) {
    const minPlausibleTotal = Math.max(MIN_TOTAL_PERFECT_MS, input.totalQuestions * 1500);
    if (totalMs < minPlausibleTotal) {
      reasons.push("perfect score answered implausibly fast");
    }
    if (medianMs !== null && medianMs < MEDIAN_FLOOR_MS) {
      reasons.push("perfect score with very fast per-question times");
    }
  }

  if (fastRatio > FAST_RATIO_THRESHOLD) {
    reasons.push(
      `${fastCount} of ${answered.length} answered question${answered.length === 1 ? "" : "s"} took under ${MIN_ANSWER_MS} ms`,
    );
  }

  return { flagged: reasons.length > 0, reasons, medianMs, fastCount, fastRatio };
}
