import {
  computeNextReview,
  type CardProgressState,
  type CardStatus,
  type NextReview,
  type ReviewGrade,
} from "@/lib/srs";

export const FLASHCARD_STORAGE_KEY = "lf-flashcard-progress";
export const FLASHCARD_UPDATE_EVENT = "lf-flashcards-updated";

export interface StoredCard {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  status: CardStatus;
  dueAt: string;
  lastReviewedAt: string;
}

type ProgressMap = Record<string, Record<string, StoredCard>>;

function readAll(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FLASHCARD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: ProgressMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded or storage disabled — progress just won't persist this time.
  }
}

/** Per-card progress for a deck, keyed by card index. */
export function loadFlashcardProgress(materialId: string): Record<number, StoredCard> {
  const byIndex = readAll()[materialId];
  if (!byIndex) return {};
  const out: Record<number, StoredCard> = {};
  for (const [key, value] of Object.entries(byIndex)) {
    const idx = Number(key);
    if (Number.isInteger(idx)) out[idx] = value;
  }
  return out;
}

/** Number of cards due right now (scheduled and not mastered). */
export function countDueCards(materialId: string, now: number = Date.now()): number {
  let count = 0;
  for (const card of Object.values(loadFlashcardProgress(materialId))) {
    if (card.status !== "mastered" && new Date(card.dueAt).getTime() <= now) count++;
  }
  return count;
}

/**
 * Records a review locally: loads the card's current state, computes the next
 * SM-2 schedule, persists it, and notifies other components (study room
 * presence, reviewer) via a window event. Returns the new schedule.
 */
export function reviewFlashcardLocally(
  materialId: string,
  cardIndex: number,
  grade: ReviewGrade,
): NextReview {
  const all = readAll();
  const byMaterial = all[materialId] ?? {};
  const stored = byMaterial[String(cardIndex)];
  const current: CardProgressState | undefined = stored
    ? {
        easeFactor: stored.easeFactor,
        intervalDays: stored.intervalDays,
        repetitions: stored.repetitions,
        status: stored.status,
      }
    : undefined;

  const next = computeNextReview(grade, current);

  byMaterial[String(cardIndex)] = {
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    repetitions: next.repetitions,
    status: next.status,
    dueAt: next.dueAt,
    lastReviewedAt: new Date().toISOString(),
  };
  all[materialId] = byMaterial;
  writeAll(all);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FLASHCARD_UPDATE_EVENT, { detail: { materialId } }));
  }
  return next;
}
