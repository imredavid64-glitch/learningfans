// Pure helpers for Interactive Study Rooms — kept framework-free so they can
// be unit tested and shared between client components and server actions.

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: WhiteboardPoint[];
}

export const WHITEBOARD_MAX_STROKES = 600;
export const WHITEBOARD_MAX_BYTES = 256 * 1024; // 256 KB snapshot cap
export const ROOM_MESSAGE_MAX_LENGTH = 500;
export const ROOM_NAME_MAX_LENGTH = 80;
export const ROOM_DESCRIPTION_MAX_LENGTH = 500;

export const POMODORO_FOCUS_SECONDS = 25 * 60;
export const POMODORO_BREAK_SECONDS = 5 * 60;

export const ALLOWED_REACTIONS = ["👍", "🎉", "❤️", "🔥", "😄", "🙏"] as const;

export function isAllowedReaction(emoji: string): boolean {
  return (ALLOWED_REACTIONS as readonly string[]).includes(emoji);
}

export interface MentionSegment {
  text: string;
  mention: boolean;
}

/**
 * Split message text into segments, flagging `@Name` tokens so the client can
 * render them highlighted without dangerouslySetInnerHTML.
 */
export function renderMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  // Only `@Name` at the start of the text or after whitespace counts as a
  // mention (so `foo@bar` stays plain), and names may contain a space
  // (e.g. the autocomplete inserts `@Ada Lovelace`). Trailing punctuation
  // like `@Ada,` is left plain.
  const re = /(^|\s)@[\p{L}\p{N}_]+(?: [\p{L}\p{N}_]+)*/gmu;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const leading = match[1].length; // 0 at line start, otherwise the whitespace char
    if (match.index + leading > last) {
      segments.push({ text: text.slice(last, match.index + leading), mention: false });
    }
    segments.push({ text: match[0].slice(leading), mention: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), mention: false });
  }
  return segments;
}

/** Text after the last `@` in the composer (for autocomplete), or null. */
export function mentionQuery(text: string): string | null {
  const idx = text.lastIndexOf("@");
  if (idx === -1) return null;
  const tail = text.slice(idx + 1);
  if (/\s/.test(tail)) return null; // already past the token
  return tail;
}

/** Filter mention candidates by an `@query`. */
export function filterMentionCandidates(
  users: { id: string; display_name: string }[],
  query: string,
): { id: string; display_name: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return users.slice(0, 6);
  return users
    .filter((u) => u.display_name.toLowerCase().includes(q))
    .slice(0, 6);
}

export type PomodoroMode = "focus" | "break";

export interface PomodoroState {
  mode: PomodoroMode;
  /** Epoch ms when the current session ends (only meaningful while running). */
  endsAt: number;
  /** Frozen remaining seconds — used while paused. */
  remainingSeconds: number;
  running: boolean;
  startedBy: string | null;
  startedAt: string | null;
}

export function createIdlePomodoro(): PomodoroState {
  return {
    mode: "focus",
    endsAt: 0,
    remainingSeconds: pomodoroDurationSeconds("focus"),
    running: false,
    startedBy: null,
    startedAt: null,
  };
}

export interface PomodoroEvent {
  action: "start" | "pause" | "reset";
  mode: PomodoroMode;
  endsAt: number;
  startedBy: string;
}

/**
 * Cap + dedupe a whiteboard snapshot. Newest strokes are kept; duplicates by
 * id are dropped (a late broadcast may re-deliver a stroke we already have).
 */
export function capStrokes(strokes: WhiteboardStroke[]): WhiteboardStroke[] {
  // Walk backwards so the newest occurrence of a duplicate id wins, then
  // restore the original order.
  const seen = new Set<string>();
  const deduped: WhiteboardStroke[] = [];
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (!stroke?.id || seen.has(stroke.id)) continue;
    seen.add(stroke.id);
    deduped.push(stroke);
  }
  deduped.reverse();
  return deduped.slice(-WHITEBOARD_MAX_STROKES);
}

/** Byte size of a serialized snapshot (browser-safe — no Buffer). */
export function whiteboardBytes(strokes: WhiteboardStroke[]): number {
  return new TextEncoder().encode(JSON.stringify(strokes)).length;
}

/** True when a snapshot is within the size cap and has a sane structure. */
export function isValidWhiteboard(strokes: unknown): strokes is WhiteboardStroke[] {
  if (!Array.isArray(strokes)) return false;
  if (strokes.length > WHITEBOARD_MAX_STROKES) return false;
  return whiteboardBytes(strokes as WhiteboardStroke[]) <= WHITEBOARD_MAX_BYTES;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function pomodoroDurationSeconds(mode: PomodoroMode): number {
  return mode === "focus" ? POMODORO_FOCUS_SECONDS : POMODORO_BREAK_SECONDS;
}

/** Seconds remaining for a pomodoro given the current time. */
export function pomodoroRemainingSeconds(state: PomodoroState, now: number): number {
  if (!state.running) return state.remainingSeconds;
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}

/** Build the next state after applying a broadcast pomodoro event. */
export function applyPomodoroEvent(
  prev: PomodoroState,
  event: PomodoroEvent,
  now: number,
): PomodoroState {
  if (event.action === "reset") {
    return createIdlePomodoro();
  }
  if (event.action === "pause") {
    return {
      ...prev,
      running: false,
      remainingSeconds: pomodoroRemainingSeconds(prev, now),
    };
  }
  // start
  return {
    mode: event.mode,
    endsAt: event.endsAt,
    remainingSeconds: Math.max(0, Math.ceil((event.endsAt - now) / 1000)),
    running: true,
    startedBy: event.startedBy,
    startedAt: new Date(now).toISOString(),
  };
}

/** Realtime channel name for a room (UUID makes it unguessable). */
export function studyRoomChannel(roomId: string): string {
  return `study-room-${roomId}`;
}

/** Jitsi room for a study room's one-click video call. */
export function studyRoomCallUrl(roomId: string, roomName: string): string {
  const slug = roomName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `https://meet.jit.si/LearningFans-Study-${slug || "room"}-${roomId.slice(0, 8)}`;
}

/** Absolute invite link for a room. */
export function studyRoomInviteUrl(roomId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/app/study-rooms/${roomId}`;
}
