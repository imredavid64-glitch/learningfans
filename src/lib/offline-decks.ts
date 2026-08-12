export const OFFLINE_DECKS_KEY = "lf-offline-decks";
export const OFFLINE_DECKS_UPDATE_EVENT = "lf-offline-decks-updated";

export interface OfflineDeck {
  materialId: string;
  title: string;
  spaceSlug: string;
  cards: { front: string; back: string }[];
  savedAt: string;
}

type OfflineDeckMap = Record<string, OfflineDeck>;

// Keep the whole cache comfortably under localStorage's ~5 MB quota.
const MAX_CACHE_BYTES = 3 * 1024 * 1024;

function byteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

function readAll(): OfflineDeckMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OFFLINE_DECKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OfflineDeckMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: OfflineDeckMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_DECKS_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded — deck won't persist offline.
  }
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_DECKS_UPDATE_EVENT));
  }
}

export function saveDeckOffline(deck: OfflineDeck): void {
  const all = readAll();
  all[deck.materialId] = deck;

  // Evict oldest decks (by savedAt) until under the cache cap.
  let bytes = byteLength(JSON.stringify(all));
  while (bytes > MAX_CACHE_BYTES && Object.keys(all).length > 1) {
    const oldest = Object.values(all).sort((a, b) => a.savedAt.localeCompare(b.savedAt))[0];
    delete all[oldest.materialId];
    bytes = byteLength(JSON.stringify(all));
  }

  writeAll(all);
  notify();
}

export function loadOfflineDeck(materialId: string): OfflineDeck | null {
  return readAll()[materialId] ?? null;
}

export function listOfflineDecks(): OfflineDeck[] {
  return Object.values(readAll()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function removeOfflineDeck(materialId: string): void {
  const all = readAll();
  delete all[materialId];
  writeAll(all);
  notify();
}

export function isDeckSavedOffline(materialId: string): boolean {
  return Boolean(readAll()[materialId]);
}

/** Approximate bytes used by the offline cache (for the settings UI). */
export function offlineCacheBytes(): number {
  return byteLength(JSON.stringify(readAll()));
}
