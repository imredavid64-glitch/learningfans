// Offline-first study rooms: queue chat messages and whiteboard snapshots in
// localStorage while disconnected, then replay them when connectivity returns.
// Framework-free so it can be unit tested and shared between the room chat and
// whiteboard client components.
//
// This is deliberately last-writer-wins (matching the existing snapshot model),
// not a CRDT merge — it preserves your own work across a dropped connection
// rather than resolving concurrent edits from multiple people.

import type { WhiteboardStroke } from "@/lib/study-room-utils";

export const OFFLINE_ROOM_SYNC_KEY = "lf-offline-room-sync";
export const OFFLINE_ROOM_SYNC_EVENT = "lf-offline-room-sync-updated";

/** Cap on queued chat messages per room (keeps localStorage bounded). */
const MAX_CHAT_QUEUE = 50;

export interface QueuedChatMessage {
  id: string;
  roomId: string;
  body: string;
  mentionIds: string[];
  createdAt: string;
}

export interface PendingWhiteboardSnapshot {
  strokes: WhiteboardStroke[];
  savedAt: string;
}

interface OfflineRoomStore {
  chatQueues: Record<string, QueuedChatMessage[]>;
  whiteboards: Record<string, PendingWhiteboardSnapshot>;
}

function emptyStore(): OfflineRoomStore {
  return { chatQueues: {}, whiteboards: {} };
}

function readAll(): OfflineRoomStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(OFFLINE_ROOM_SYNC_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<OfflineRoomStore>;
    return {
      chatQueues: parsed?.chatQueues && typeof parsed.chatQueues === "object" ? parsed.chatQueues : {},
      whiteboards: parsed?.whiteboards && typeof parsed.whiteboards === "object" ? parsed.whiteboards : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeAll(store: OfflineRoomStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_ROOM_SYNC_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage disabled — the pending item just won't persist.
  }
}

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_ROOM_SYNC_EVENT));
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Queue a chat message for later delivery. Returns the queued record so the
 * client can render it optimistically as "pending".
 */
export function queueChatMessage(
  roomId: string,
  body: string,
  mentionIds: string[] = [],
): QueuedChatMessage {
  const store = readAll();
  const msg: QueuedChatMessage = {
    id: makeId(),
    roomId,
    body,
    mentionIds: mentionIds.filter((id) => typeof id === "string" && id.length > 0),
    createdAt: new Date().toISOString(),
  };
  const queue = store.chatQueues[roomId] ?? [];
  queue.push(msg);
  store.chatQueues[roomId] = queue.slice(-MAX_CHAT_QUEUE);
  writeAll(store);
  notify();
  return msg;
}

/** Undelivered chat messages for a room, oldest first (delivery order). */
export function pendingChatMessages(roomId: string): QueuedChatMessage[] {
  return (readAll().chatQueues[roomId] ?? []).slice();
}

export function pendingChatCount(roomId: string): number {
  return (readAll().chatQueues[roomId] ?? []).length;
}

/** Remove one queued message after it has been delivered successfully. */
export function removeChatMessage(roomId: string, id: string): void {
  const store = readAll();
  const queue = (store.chatQueues[roomId] ?? []).filter((m) => m.id !== id);
  if (queue.length === 0) delete store.chatQueues[roomId];
  else store.chatQueues[roomId] = queue;
  writeAll(store);
  notify();
}

/** Drop the whole queue for a room (e.g. the room ended while offline). */
export function clearChatQueue(roomId: string): void {
  const store = readAll();
  delete store.chatQueues[roomId];
  writeAll(store);
  notify();
}

/** Persist the latest whiteboard snapshot until a successful save can be made. */
export function savePendingWhiteboard(roomId: string, strokes: WhiteboardStroke[]): void {
  const store = readAll();
  store.whiteboards[roomId] = { strokes, savedAt: new Date().toISOString() };
  writeAll(store);
  notify();
}

export function loadPendingWhiteboard(roomId: string): PendingWhiteboardSnapshot | null {
  return readAll().whiteboards[roomId] ?? null;
}

export function clearPendingWhiteboard(roomId: string): void {
  const store = readAll();
  delete store.whiteboards[roomId];
  writeAll(store);
  notify();
}

/** Room ids that have anything waiting to sync (chat or whiteboard). */
export function roomsWithPendingSync(): string[] {
  const store = readAll();
  const ids = new Set<string>();
  for (const roomId of Object.keys(store.chatQueues)) {
    if (store.chatQueues[roomId]?.length) ids.add(roomId);
  }
  for (const roomId of Object.keys(store.whiteboards)) {
    if (store.whiteboards[roomId]) ids.add(roomId);
  }
  return [...ids];
}
