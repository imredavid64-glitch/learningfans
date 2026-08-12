export type ReviewGrade = "again" | "hard" | "good" | "easy";

export type CardStatus = "new" | "learning" | "review" | "mastered";

export interface CardProgressState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  status: CardStatus;
}

export interface NextReview extends CardProgressState {
  dueAt: string;
}

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const DAY_MS = 86_400_000;
const RESCHEDULE_AGAIN_MINUTES = 10;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Simplified SM-2 scheduling. `current` defaults to a fresh card.
 * - again → reset to learning, due again in 10 minutes, ease -0.20
 * - hard  → 1+ days, ease -0.15
 * - good  → classic SM-2 intervals (1, 6, interval*ease), ease +0.05
 * - easy  → faster intervals, ease +0.10
 */
export function computeNextReview(
  grade: ReviewGrade,
  current: CardProgressState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, status: "new" },
): NextReview {
  let ease = current.easeFactor;
  let reps = current.repetitions;
  let interval = current.intervalDays;
  let status: CardStatus = current.status;

  switch (grade) {
    case "again":
      ease = Math.max(MIN_EASE, ease - 0.2);
      reps = 0;
      interval = 0;
      status = "learning";
      break;
    case "hard":
      ease = Math.max(MIN_EASE, ease - 0.15);
      reps += 1;
      interval = reps === 1 ? 1 : Math.max(1, Math.round(current.intervalDays * 1.2));
      status = "review";
      break;
    case "good":
      ease = Math.min(MAX_EASE, ease + 0.05);
      reps += 1;
      if (reps === 1) interval = 1;
      else if (reps === 2) interval = 6;
      else interval = Math.max(1, Math.round(interval * ease));
      status = "review";
      break;
    case "easy":
      ease = Math.min(MAX_EASE, ease + 0.1);
      reps += 1;
      if (reps === 1) interval = 4;
      else if (reps === 2) interval = 10;
      else interval = Math.max(1, Math.round(interval * ease * 1.3));
      status = "review";
      break;
  }

  if (reps >= 5 && grade !== "again") status = "mastered";
  if (grade === "again") status = "learning";

  const dueAt = new Date(Date.now() + interval * DAY_MS);
  if (interval === 0) {
    dueAt.setMinutes(dueAt.getMinutes() + RESCHEDULE_AGAIN_MINUTES);
  }

  return {
    easeFactor: round2(ease),
    intervalDays: interval,
    repetitions: reps,
    status,
    dueAt: dueAt.toISOString(),
  };
}
