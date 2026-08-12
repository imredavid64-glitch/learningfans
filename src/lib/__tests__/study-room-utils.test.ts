import { describe, it, expect } from "vitest";
import {
  capStrokes,
  whiteboardBytes,
  isValidWhiteboard,
  formatCountdown,
  pomodoroDurationSeconds,
  pomodoroRemainingSeconds,
  applyPomodoroEvent,
  studyRoomChannel,
  studyRoomCallUrl,
  studyRoomInviteUrl,
  WHITEBOARD_MAX_STROKES,
  WHITEBOARD_MAX_BYTES,
  type WhiteboardStroke,
  type PomodoroState,
} from "@/lib/study-room-utils";

function stroke(id: string, points = 4): WhiteboardStroke {
  const pts = Array.from({ length: points }, (_, i) => ({ x: i, y: i * 2 }));
  return { id, tool: "pen", color: "#000000", width: 3, points: pts };
}

describe("whiteboard snapshots", () => {
  it("dedupes strokes by id, keeping the newest", () => {
    const dup = [
      { ...stroke("a"), color: "#111111" },
      { ...stroke("a"), color: "#222222" },
      stroke("b"),
    ];
    const capped = capStrokes(dup);
    expect(capped).toHaveLength(2);
    expect(capped[0].color).toBe("#222222");
  });

  it("drops invalid entries without ids", () => {
    const bad = [stroke("a"), { id: "", tool: "pen" } as unknown as WhiteboardStroke];
    expect(capStrokes(bad)).toHaveLength(1);
  });

  it("caps at WHITEBOARD_MAX_STROKES, keeping the newest", () => {
    const many = Array.from({ length: WHITEBOARD_MAX_STROKES + 50 }, (_, i) =>
      stroke(`s${i}`),
    );
    const capped = capStrokes(many);
    expect(capped).toHaveLength(WHITEBOARD_MAX_STROKES);
    expect(capped[0].id).toBe("s50");
    expect(capped[capped.length - 1].id).toBe(`s${WHITEBOARD_MAX_STROKES + 49}`);
  });

  it("measures byte size and rejects oversized snapshots", () => {
    const tiny = [stroke("a")];
    expect(whiteboardBytes(tiny)).toBeGreaterThan(0);
    expect(isValidWhiteboard(tiny)).toBe(true);

    const huge = Array.from({ length: WHITEBOARD_MAX_STROKES }, (_, i) =>
      stroke(`h${i}`, 200),
    );
    expect(isValidWhiteboard(huge)).toBe(false);
    expect(whiteboardBytes(huge)).toBeGreaterThan(WHITEBOARD_MAX_BYTES);
  });

  it("rejects non-array payloads", () => {
    expect(isValidWhiteboard(null)).toBe(false);
    expect(isValidWhiteboard("nope")).toBe(false);
    expect(isValidWhiteboard({})).toBe(false);
  });
});

describe("pomodoro", () => {
  const now = 1_000_000;

  it("formats countdowns", () => {
    expect(formatCountdown(25 * 60)).toBe("25:00");
    expect(formatCountdown(59)).toBe("00:59");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });

  it("returns per-mode durations", () => {
    expect(pomodoroDurationSeconds("focus")).toBe(1500);
    expect(pomodoroDurationSeconds("break")).toBe(300);
  });

  it("computes remaining time for a running session", () => {
    const state: PomodoroState = {
      mode: "focus",
      endsAt: now + 10_000,
      remainingSeconds: 10,
      running: true,
      startedBy: "u1",
      startedAt: null,
    };
    expect(pomodoroRemainingSeconds(state, now)).toBe(10);
    expect(pomodoroRemainingSeconds(state, now + 60_000)).toBe(0);
  });

  it("paused state freezes the stored remaining seconds", () => {
    const state: PomodoroState = {
      mode: "focus",
      endsAt: now + 5_000,
      remainingSeconds: 7,
      running: false,
      startedBy: null,
      startedAt: null,
    };
    expect(pomodoroRemainingSeconds(state, now)).toBe(7);
    expect(pomodoroRemainingSeconds(state, now + 999_999)).toBe(7);
  });

  it("applies start/pause/reset broadcast events", () => {
    const base: PomodoroState = {
      mode: "focus",
      endsAt: 0,
      remainingSeconds: 1500,
      running: false,
      startedBy: null,
      startedAt: null,
    };
    const started = applyPomodoroEvent(
      base,
      { action: "start", mode: "break", endsAt: now + 300_000, startedBy: "u2" },
      now,
    );
    expect(started.running).toBe(true);
    expect(started.mode).toBe("break");
    expect(started.remainingSeconds).toBe(300);

    const paused = applyPomodoroEvent(started, { action: "pause", mode: "break", endsAt: 0, startedBy: "u2" }, now);
    expect(paused.running).toBe(false);
    expect(paused.remainingSeconds).toBe(300);

    const reset = applyPomodoroEvent(paused, { action: "reset", mode: "focus", endsAt: 0, startedBy: "u2" }, now);
    expect(reset.running).toBe(false);
    expect(reset.mode).toBe("focus");
    expect(reset.remainingSeconds).toBe(1500);
    expect(reset.startedBy).toBeNull();
  });
});

describe("room links", () => {
  it("builds the realtime channel name from the room id", () => {
    expect(studyRoomChannel("abc-123")).toBe("study-room-abc-123");
  });

  it("builds a stable jitsi room from name + id", () => {
    const url = studyRoomCallUrl("room-id-12345678", "Calculus Study Group!");
    expect(url).toContain("meet.jit.si");
    expect(url).toContain("calculus-study-group");
    expect(url).toContain("room-id");
  });

  it("builds invite links without double slashes", () => {
    expect(studyRoomInviteUrl("r1", "https://learningfans.vercel.app")).toBe(
      "https://learningfans.vercel.app/app/study-rooms/r1",
    );
    expect(studyRoomInviteUrl("r1", "https://learningfans.vercel.app/")).toBe(
      "https://learningfans.vercel.app/app/study-rooms/r1",
    );
  });
});
