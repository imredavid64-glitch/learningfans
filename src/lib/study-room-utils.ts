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
  /** Author — enables per-user stroke colors (matches their presence cursor). */
  author_id?: string;
  author_name?: string;
}

export const WHITEBOARD_MAX_STROKES = 600;
export const WHITEBOARD_MAX_BYTES = 256 * 1024; // 256 KB snapshot cap
export const ROOM_MESSAGE_MAX_LENGTH = 500;
export const ROOM_NAME_MAX_LENGTH = 80;
export const ROOM_DESCRIPTION_MAX_LENGTH = 500;

export const POMODORO_FOCUS_SECONDS = 25 * 60;
export const POMODORO_BREAK_SECONDS = 5 * 60;

// Room-chat flood control: max messages per rolling window, per user.
export const ROOM_CHAT_RATE_MAX = 6;
export const ROOM_CHAT_RATE_WINDOW_SECONDS = 15;
// Host mute duration (a short cooldown rather than an indefinite ban).
export const ROOM_MUTE_SECONDS = 10 * 60;

// Study-party reminders: fire this many minutes before a party starts.
export const PARTY_REMINDER_LEAD_MINUTES = 15;
// RSVPing to a party starting within this horizon triggers an instant reminder.
export const RSVP_REMINDER_HORIZON_MINUTES = 30;

export const ALLOWED_REACTIONS = ["👍", "🎉", "❤️", "🔥", "😄", "🙏"] as const;

/**
 * Find users whose display name is referenced as a plain `@Name` token in a
 * message body (no picker needed — typing `@Ada` at a word boundary matches).
 * Case-insensitive; the token must end at whitespace, end-of-text, or
 * punctuation so `@Al` never matches "Alice". Returns their user ids.
 */
export function extractMentionsFromBody(
  body: string,
  users: { id: string; display_name: string }[],
): string[] {
  const found: string[] = [];
  for (const user of users) {
    if (!user?.display_name || !user.id) continue;
    const name = user.display_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\s)@${name}(?=\\s|$|[.,!?;:])`, "i");
    if (re.test(body)) found.push(user.id);
  }
  return found;
}

/** Human tooltip listing who reacted, e.g. "Ada, Lin and you". */
export function reactionTooltip(names: string[], me: boolean): string {
  const clean = [...new Set(names.filter(Boolean))];
  if (clean.length === 0) return "No reactions";
  if (me) {
    return clean.length === 1
      ? "You"
      : `${clean.join(", ")} and you`;
  }
  return clean.join(", ");
}

export interface ChatTreeNode<T> {
  message: T;
  children: ChatTreeNode<T>[];
}

/**
 * Build a reply tree from room chat messages. Roots are ordered by created_at
 * (oldest first); replies nest under their parent with depth capped at
 * `MAX_CHAT_DEPTH` — deeper replies are re-parented onto their ancestor so
 * the UI stays scannable (the data keeps its real parent_id).
 */
export const MAX_CHAT_DEPTH = 3;

export function buildMessageTree<T extends { id: string; parent_id?: string | null; created_at: string }>(
  messages: T[],
): ChatTreeNode<T>[] {
  const byId = new Map<string, T>();
  for (const m of messages) byId.set(m.id, m);

  const depthMemo = new Map<string, number>();
  const depthOf = (m: T): number => {
    const cached = depthMemo.get(m.id);
    if (cached !== undefined) return cached;
    if (!m.parent_id || !byId.has(m.parent_id)) {
      depthMemo.set(m.id, 1);
      return 1;
    }
    const d = depthOf(byId.get(m.parent_id)!) + 1;
    depthMemo.set(m.id, d);
    return d;
  };

  // The ancestor at exactly `targetDepth` (1 = root), or null.
  const ancestorAtDepth = (m: T, targetDepth: number): T | null => {
    let cur = m;
    let curDepth = depthOf(m);
    while (cur.parent_id && byId.has(cur.parent_id) && curDepth > targetDepth) {
      cur = byId.get(cur.parent_id)!;
      curDepth -= 1;
    }
    return curDepth === targetDepth ? cur : null;
  };

  const nodes = new Map<string, ChatTreeNode<T>>();
  for (const m of messages) nodes.set(m.id, { message: m, children: [] });

  const roots: ChatTreeNode<T>[] = [];
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const m of sorted) {
    const natural = depthOf(m) <= MAX_CHAT_DEPTH;
    let parentId = natural ? m.parent_id ?? null : null;
    if (!natural) {
      parentId = ancestorAtDepth(m, MAX_CHAT_DEPTH - 1)?.id ?? null;
    }
    const node = nodes.get(m.id)!;
    if (parentId && nodes.has(parentId)) {
      node.message = { ...m, parent_id: parentId };
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Distinct per-user cursor colors on the whiteboard. */
export const CURSOR_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
] as const;

/** Deterministic color for a user's whiteboard cursor. */
export function cursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

/**
 * Color to render a stroke with. In "color by person" mode each author's
 * strokes use their deterministic palette color (the same one their live
 * presence cursor uses), so you can tell who drew what. Falls back to the
 * stroke's own chosen color for legacy strokes or when disabled.
 */
export function strokeRenderColor(stroke: WhiteboardStroke, byPerson: boolean): string {
  if (byPerson && stroke.author_id) return cursorColor(stroke.author_id);
  return stroke.color;
}

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

/** Human countdown for a scheduled party (e.g. "2d 3h", "45m 12s"). */
export function formatPartyCountdown(startsAtMs: number, nowMs: number): string {
  const total = Math.max(0, Math.floor((startsAtMs - nowMs) / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** True when a party starts within the reminder lead window (not yet started). */
export function partyReminderDue(startsAtMs: number, nowMs: number): boolean {
  const untilStart = startsAtMs - nowMs;
  return untilStart > 0 && untilStart <= PARTY_REMINDER_LEAD_MINUTES * 60_000;
}

/** True when RSVPing to a close party should remind immediately. */
export function shouldRsvpRemindNow(startsAtMs: number, nowMs: number): boolean {
  const untilStart = startsAtMs - nowMs;
  return untilStart > 0 && untilStart <= RSVP_REMINDER_HORIZON_MINUTES * 60_000;
}

/**
 * True when the raw Realtime presence state shows nobody else connected and at
 * most one connection for `myUserId` — i.e. closing my last tab empties the
 * room. Used by the study-party auto-end trigger (multi-tab aware).
 */
export function isLastPresentUser(state: Record<string, unknown[]>, myUserId: string): boolean {
  for (const [key, metas] of Object.entries(state)) {
    if (key === myUserId) continue;
    if (Array.isArray(metas) && metas.length > 0) return false;
  }
  const mine = state[myUserId];
  return !Array.isArray(mine) || mine.length <= 1;
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
