import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  countDueCards,
  FLASHCARD_STORAGE_KEY,
  FLASHCARD_UPDATE_EVENT,
  loadFlashcardProgress,
  reviewFlashcardLocally,
} from "@/lib/flashcard-storage";

const MATERIAL_ID = "deck-123";

beforeEach(() => {
  window.localStorage.clear();
});

describe("flashcard-storage (local SRS progress)", () => {
  it("persists a review and returns the next schedule", () => {
    const next = reviewFlashcardLocally(MATERIAL_ID, 0, "good");

    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(loadFlashcardProgress(MATERIAL_ID)[0]).toMatchObject({
      repetitions: 1,
      intervalDays: 1,
      status: "review",
      dueAt: next.dueAt,
    });
  });

  it("loads progress keyed by card index", () => {
    reviewFlashcardLocally(MATERIAL_ID, 0, "good");
    reviewFlashcardLocally(MATERIAL_ID, 1, "again");

    const progress = loadFlashcardProgress(MATERIAL_ID);
    expect(Object.keys(progress).sort()).toEqual(["0", "1"]);
    expect(progress[0].status).toBe("review");
    expect(progress[1].status).toBe("learning");
  });

  it("isolates progress per deck", () => {
    reviewFlashcardLocally(MATERIAL_ID, 0, "good");
    expect(loadFlashcardProgress("other-deck")).toEqual({});
  });

  it("countDueCards counts scheduled non-mastered cards that are due", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const stored = {
      [MATERIAL_ID]: {
        "0": { easeFactor: 2.5, intervalDays: 0, repetitions: 0, status: "learning", dueAt: past, lastReviewedAt: past },
        "1": { easeFactor: 2.6, intervalDays: 6, repetitions: 5, status: "mastered", dueAt: past, lastReviewedAt: past },
      },
    };
    window.localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(stored));

    // The learning card is due; the mastered one is not.
    expect(countDueCards(MATERIAL_ID)).toBe(1);
  });

  it("a card reviewed 'again' is rescheduled soon but not counted as due yet", () => {
    reviewFlashcardLocally(MATERIAL_ID, 0, "again");
    expect(countDueCards(MATERIAL_ID)).toBe(0); // due in ~10 minutes
  });

  it("dispatches an update event so the study room can re-track", () => {
    const spy = vi.fn();
    window.addEventListener(FLASHCARD_UPDATE_EVENT, spy);

    reviewFlashcardLocally(MATERIAL_ID, 0, "good");

    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(FLASHCARD_UPDATE_EVENT, spy);
  });

  it("does not throw when localStorage is full or unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => reviewFlashcardLocally(MATERIAL_ID, 0, "good")).not.toThrow();
    vi.restoreAllMocks();
  });

  it("ignores corrupt stored data", () => {
    window.localStorage.setItem(FLASHCARD_STORAGE_KEY, "{not json");
    expect(loadFlashcardProgress(MATERIAL_ID)).toEqual({});
    expect(countDueCards(MATERIAL_ID)).toBe(0);
  });
});
