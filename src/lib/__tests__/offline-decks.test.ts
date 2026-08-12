import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isDeckSavedOffline,
  listOfflineDecks,
  loadOfflineDeck,
  OFFLINE_DECKS_KEY,
  OFFLINE_DECKS_UPDATE_EVENT,
  offlineCacheBytes,
  removeOfflineDeck,
  saveDeckOffline,
  type OfflineDeck,
} from "@/lib/offline-decks";

const DECK_A: OfflineDeck = {
  materialId: "a",
  title: "Kinematics",
  spaceSlug: "ap-physics",
  cards: [{ front: "v = ?", back: "d/t" }],
  savedAt: "2026-08-10T00:00:00Z",
};

const DECK_B: OfflineDeck = {
  materialId: "b",
  title: "Thermodynamics",
  spaceSlug: "ap-physics",
  cards: [{ front: "Q = ?", back: "mcΔT" }],
  savedAt: "2026-08-11T00:00:00Z",
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("offline-decks (local deck cache)", () => {
  it("round-trips a saved deck", () => {
    saveDeckOffline(DECK_A);
    expect(isDeckSavedOffline("a")).toBe(true);
    expect(loadOfflineDeck("a")).toEqual(DECK_A);
  });

  it("lists newest first and removes decks", () => {
    saveDeckOffline(DECK_A);
    saveDeckOffline(DECK_B);
    expect(listOfflineDecks().map((d) => d.materialId)).toEqual(["b", "a"]);

    removeOfflineDeck("a");
    expect(listOfflineDecks().map((d) => d.materialId)).toEqual(["b"]);
    expect(loadOfflineDeck("a")).toBeNull();
  });

  it("tracks cache size and evicts the oldest deck over the cap", () => {
    // Two small decks — total well under the cap.
    saveDeckOffline(DECK_A);
    saveDeckOffline(DECK_B);
    expect(offlineCacheBytes()).toBeGreaterThan(0);

    // A huge deck should evict older ones to stay under the cap.
    const huge: OfflineDeck = {
      materialId: "c",
      title: "Huge",
      spaceSlug: "s",
      cards: Array.from({ length: 5000 }, (_, i) => ({
        front: `Front ${i} `.repeat(30),
        back: `Back ${i} `.repeat(30),
      })),
      savedAt: "2026-08-12T00:00:00Z",
    };
    saveDeckOffline(huge);
    expect(loadOfflineDeck("c")).not.toBeNull();
    expect(loadOfflineDeck("a")).toBeNull();
  });

  it("notifies listeners on changes", () => {
    const spy = vi.fn();
    window.addEventListener(OFFLINE_DECKS_UPDATE_EVENT, spy);

    saveDeckOffline(DECK_A);
    removeOfflineDeck("a");

    expect(spy).toHaveBeenCalledTimes(2);
    window.removeEventListener(OFFLINE_DECKS_UPDATE_EVENT, spy);
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveDeckOffline(DECK_A)).not.toThrow();
    vi.restoreAllMocks();
  });

  it("ignores corrupt stored data", () => {
    window.localStorage.setItem(OFFLINE_DECKS_KEY, "not json");
    expect(listOfflineDecks()).toEqual([]);
    expect(loadOfflineDeck("a")).toBeNull();
  });
});
