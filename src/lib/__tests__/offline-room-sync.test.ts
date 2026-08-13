import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OFFLINE_ROOM_SYNC_KEY,
  OFFLINE_ROOM_SYNC_EVENT,
  queueChatMessage,
  pendingChatMessages,
  pendingChatCount,
  removeChatMessage,
  clearChatQueue,
  savePendingWhiteboard,
  loadPendingWhiteboard,
  clearPendingWhiteboard,
  roomsWithPendingSync,
} from "@/lib/offline-room-sync";
import type { WhiteboardStroke } from "@/lib/study-room-utils";

function stroke(id: string): WhiteboardStroke {
  return {
    id,
    tool: "pen",
    color: "#000000",
    width: 3,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("offline room chat queue", () => {
  it("round-trips queued messages in delivery order", () => {
    queueChatMessage("r1", "first");
    queueChatMessage("r1", "second", ["u1"]);
    const queued = pendingChatMessages("r1");
    expect(queued.map((m) => m.body)).toEqual(["first", "second"]);
    expect(queued[1].mentionIds).toEqual(["u1"]);
    expect(pendingChatCount("r1")).toBe(2);
  });

  it("keeps rooms isolated", () => {
    queueChatMessage("r1", "a");
    queueChatMessage("r2", "b");
    expect(pendingChatMessages("r1").map((m) => m.body)).toEqual(["a"]);
    expect(pendingChatMessages("r2").map((m) => m.body)).toEqual(["b"]);
  });

  it("removes a delivered message and clears the whole queue", () => {
    const a = queueChatMessage("r1", "a");
    queueChatMessage("r1", "b");
    removeChatMessage("r1", a.id);
    expect(pendingChatMessages("r1").map((m) => m.body)).toEqual(["b"]);

    clearChatQueue("r1");
    expect(pendingChatMessages("r1")).toEqual([]);
    expect(pendingChatCount("r1")).toBe(0);
  });

  it("caps the queue at 50, dropping the oldest", () => {
    for (let i = 0; i < 55; i++) queueChatMessage("r1", `m${i}`);
    const queued = pendingChatMessages("r1");
    expect(queued).toHaveLength(50);
    expect(queued[0].body).toBe("m5");
    expect(queued[49].body).toBe("m54");
  });

  it("drops non-string mention ids", () => {
    const msg = queueChatMessage("r1", "hi", ["ok", "", "u1" as unknown as string]);
    expect(msg.mentionIds).toEqual(["ok", "u1"]);
  });
});

describe("offline whiteboard snapshot", () => {
  it("round-trips the latest snapshot", () => {
    const strokes = [stroke("s1"), stroke("s2")];
    savePendingWhiteboard("r1", strokes);
    expect(loadPendingWhiteboard("r1")?.strokes).toEqual(strokes);

    // Later snapshots replace earlier ones.
    savePendingWhiteboard("r1", [stroke("s3")]);
    expect(loadPendingWhiteboard("r1")?.strokes.map((s) => s.id)).toEqual(["s3"]);
  });

  it("clears a pending snapshot", () => {
    savePendingWhiteboard("r1", [stroke("s1")]);
    clearPendingWhiteboard("r1");
    expect(loadPendingWhiteboard("r1")).toBeNull();
  });
});

describe("pending sync summary", () => {
  it("reports rooms with queued chat and/or whiteboard work", () => {
    queueChatMessage("r1", "hi");
    savePendingWhiteboard("r2", [stroke("s1")]);
    queueChatMessage("r2", "also");
    const ids = roomsWithPendingSync();
    expect(ids.sort()).toEqual(["r1", "r2"]);

    clearChatQueue("r1");
    clearPendingWhiteboard("r2");
    removeChatMessage("r2", pendingChatMessages("r2")[0].id);
    expect(roomsWithPendingSync()).toEqual([]);
  });
});

describe("robustness", () => {
  it("notifies listeners on changes", () => {
    const spy = vi.fn();
    window.addEventListener(OFFLINE_ROOM_SYNC_EVENT, spy);

    queueChatMessage("r1", "hi");
    savePendingWhiteboard("r1", [stroke("s1")]);
    clearChatQueue("r1");

    expect(spy).toHaveBeenCalledTimes(3);
    window.removeEventListener(OFFLINE_ROOM_SYNC_EVENT, spy);
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => queueChatMessage("r1", "hi")).not.toThrow();
    expect(() => savePendingWhiteboard("r1", [stroke("s1")])).not.toThrow();
    vi.restoreAllMocks();
  });

  it("ignores corrupt stored data", () => {
    window.localStorage.setItem(OFFLINE_ROOM_SYNC_KEY, "not json");
    expect(pendingChatMessages("r1")).toEqual([]);
    expect(loadPendingWhiteboard("r1")).toBeNull();
    expect(roomsWithPendingSync()).toEqual([]);
  });
});
