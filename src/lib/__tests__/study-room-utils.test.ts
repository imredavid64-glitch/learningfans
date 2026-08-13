import { describe, it, expect } from "vitest";
import {
  capStrokes,
  whiteboardBytes,
  isValidWhiteboard,
  formatCountdown,
  formatPartyCountdown,
  partyReminderDue,
  shouldRsvpRemindNow,
  isLastPresentUser,
  pomodoroDurationSeconds,
  pomodoroRemainingSeconds,
  applyPomodoroEvent,
  studyRoomChannel,
  studyRoomCallUrl,
  studyRoomInviteUrl,
  WHITEBOARD_MAX_STROKES,
  WHITEBOARD_MAX_BYTES,
  isAllowedReaction,
  renderMentions,
  mentionQuery,
  filterMentionCandidates,
  ALLOWED_REACTIONS,
  cursorColor,
  CURSOR_COLORS,
  strokeRenderColor,
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

  it("formats party countdowns across time scales", () => {
    const now = 1_000_000;
    expect(formatPartyCountdown(now + 45 * 1000, now)).toBe("45s");
    expect(formatPartyCountdown(now + (5 * 60 + 12) * 1000, now)).toBe("5m 12s");
    expect(formatPartyCountdown(now + (3 * 3600 + 5 * 60) * 1000, now)).toBe("3h 5m");
    expect(formatPartyCountdown(now + (2 * 86_400 + 4 * 3600) * 1000, now)).toBe("2d 4h");
    expect(formatPartyCountdown(now - 1000, now)).toBe("0s");
  });

  it("deems party reminders due only inside the lead window", () => {
    const now = 1_000_000;
    expect(partyReminderDue(now + 5 * 60_000, now)).toBe(true);
    expect(partyReminderDue(now + 15 * 60_000, now)).toBe(true);
    expect(partyReminderDue(now + 16 * 60_000, now)).toBe(false);
    expect(partyReminderDue(now - 1000, now)).toBe(false);
    expect(partyReminderDue(now, now)).toBe(false);
  });

  it("reminds immediately when RSVPing to a close party", () => {
    const now = 1_000_000;
    expect(shouldRsvpRemindNow(now + 10 * 60_000, now)).toBe(true);
    expect(shouldRsvpRemindNow(now + 30 * 60_000, now)).toBe(true);
    expect(shouldRsvpRemindNow(now + 45 * 60_000, now)).toBe(false);
    expect(shouldRsvpRemindNow(now - 60_000, now)).toBe(false);
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

describe("isLastPresentUser", () => {
  it("is true when I'm the only connection (or nobody is present)", () => {
    expect(isLastPresentUser({ me: [{ user_id: "me" }] }, "me")).toBe(true);
    expect(isLastPresentUser({}, "me")).toBe(true);
  });

  it("is false when another user is still present", () => {
    expect(
      isLastPresentUser(
        { me: [{ user_id: "me" }], other: [{ user_id: "other" }] },
        "me",
      ),
    ).toBe(false);
  });

  it("is false when I have another tab open", () => {
    expect(isLastPresentUser({ me: [{}, {}] }, "me")).toBe(false);
  });
});

describe("mentions & reactions", () => {
  it("flags @Name tokens for rendering and leaves the rest plain", () => {
    const segments = renderMentions("hey @Ada, want to review @Lin?");
    expect(segments).toEqual([
      { text: "hey ", mention: false },
      { text: "@Ada", mention: true },
      { text: ", want to review ", mention: false },
      { text: "@Lin", mention: true },
      { text: "?", mention: false },
    ]);
  });

  it("returns a single plain segment when there are no mentions", () => {
    expect(renderMentions("just a normal message")).toEqual([
      { text: "just a normal message", mention: false },
    ]);
  });

  it("keeps an @ at the end of a word as plain text", () => {
    const segments = renderMentions("email me at foo@bar");
    expect(segments.every((s) => !s.mention)).toBe(true);
  });

  it("extracts the autocomplete query after the last @", () => {
    expect(mentionQuery("review with @")).toBe("");
    expect(mentionQuery("review with @Ada")).toBe("Ada");
    expect(mentionQuery("review with @Ada now")).toBeNull();
    expect(mentionQuery("no mention here")).toBeNull();
  });

  it("filters mention candidates by name, capping at six", () => {
    const users = [
      { id: "1", display_name: "Ada Lovelace" },
      { id: "2", display_name: "Alan Turing" },
      { id: "3", display_name: "Grace Hopper" },
    ];
    expect(filterMentionCandidates(users, "la").map((u) => u.id)).toEqual(["1", "2"]);
    expect(filterMentionCandidates(users, "hopper").map((u) => u.id)).toEqual(["3"]);
    expect(filterMentionCandidates(users, "zzz")).toEqual([]);
  });

  it("assigns deterministic in-palette cursor colors", () => {
    const c1 = cursorColor("user-abc");
    const c2 = cursorColor("user-abc");
    expect(c1).toBe(c2);
    expect(CURSOR_COLORS).toContain(c1);
    expect(cursorColor("different-user")).not.toBe(c1);
    const seen = new Set(Array.from({ length: 40 }, (_, i) => cursorColor(`u${i}`)));
    expect(seen.size).toBeGreaterThan(1); // spreads across the palette
  });

  it("renders per-author stroke colors in by-person mode", () => {
    const s = { ...stroke("a"), author_id: "user-1", color: "#111111" };
    expect(strokeRenderColor(s, true)).toBe(cursorColor("user-1"));
    expect(strokeRenderColor(s, false)).toBe("#111111");
    // Legacy stroke without an author falls back to its own color.
    const legacy = stroke("b");
    expect(strokeRenderColor(legacy, true)).toBe("#000000");
  });

  it("only allows the curated reaction set", () => {
    for (const e of ALLOWED_REACTIONS) {
      expect(isAllowedReaction(e)).toBe(true);
    }
    expect(isAllowedReaction("🚀")).toBe(false);
    expect(isAllowedReaction("not an emoji")).toBe(false);
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
