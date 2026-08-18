"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { sendRoomMessage, toggleReaction } from "@/actions/study-rooms";
import {
  ALLOWED_REACTIONS,
  ROOM_MESSAGE_MAX_LENGTH,
  buildMessageTree,
  extractMentionsFromBody,
  filterMentionCandidates,
  mentionQuery,
  reactionTooltip,
  renderMentions,
  type ChatTreeNode,
} from "@/lib/study-room-utils";
import {
  OFFLINE_ROOM_SYNC_EVENT,
  pendingChatMessages,
  queueChatMessage,
  removeChatMessage,
  type QueuedChatMessage,
} from "@/lib/offline-room-sync";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReportButton } from "@/components/moderation/report-button";
import { CloudOff, CornerUpLeft, MessageSquare, Send, ShieldAlert, SmilePlus, X } from "lucide-react";

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  hidden?: boolean;
  /** Reply target — threaded chat. */
  parent_id?: string | null;
  profiles: { display_name: string; avatar_url?: string | null } | null;
}

export interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  me: boolean;
  names: string[];
}

interface RoomChatProps {
  roomId: string;
  userId: string;
  initialMessages: RoomMessage[];
  mentionableUsers: { id: string; display_name: string }[];
  initialReactions: ReactionRow[];
  disabled?: boolean;
  /** Host-moderated: viewer can't post while muted/banned. */
  muted?: boolean;
  banned?: boolean;
}

function nameOf(userId: string, known: Map<string, string>): string {
  return known.get(userId) ?? "Someone";
}

function groupReactions(
  rows: ReactionRow[],
  userId: string,
  names: Map<string, string>,
): Map<string, ReactionSummary[]> {
  const map = new Map<string, ReactionSummary[]>();
  for (const row of rows) {
    const list = map.get(row.message_id) ?? [];
    const existing = list.find((s) => s.emoji === row.emoji);
    const name = nameOf(row.user_id, names);
    if (existing) {
      existing.count += 1;
      existing.me = existing.me || row.user_id === userId;
      existing.names.push(name);
    } else {
      list.push({ emoji: row.emoji, count: 1, me: row.user_id === userId, names: [name] });
    }
    map.set(row.message_id, list);
  }
  return map;
}

/** Toggle the current user's reaction in the local reaction map (idempotent). */
function flipLocalReaction(
  prev: Map<string, ReactionSummary[]>,
  messageId: string,
  emoji: string,
  myName: string,
): Map<string, ReactionSummary[]> {
  const next = new Map(prev);
  const list = [...(next.get(messageId) ?? [])];
  const existing = list.find((s) => s.emoji === emoji);
  if (existing && existing.me) {
    existing.count -= 1;
    existing.me = false;
    existing.names = existing.names.filter((n) => n !== myName);
    next.set(messageId, list.filter((s) => s.count > 0));
  } else if (existing) {
    existing.count += 1;
    existing.me = true;
    existing.names = [...existing.names, myName];
    next.set(messageId, list);
  } else {
    list.push({ emoji, count: 1, me: true, names: [myName] });
    next.set(messageId, list);
  }
  return next;
}

export function RoomChat({
  roomId,
  userId,
  initialMessages,
  mentionableUsers,
  initialReactions,
  disabled,
  muted,
  banned,
}: RoomChatProps) {
  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages);
  const initialNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of mentionableUsers) map.set(u.id, u.display_name);
    return map;
  }, [mentionableUsers]);
  const namesRef = useRef<Map<string, string>>(initialNameMap);
  const myName = initialNameMap.get(userId) ?? "You";
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [reactions, setReactions] = useState<Map<string, ReactionSummary[]>>(() =>
    groupReactions(initialReactions, userId, initialNameMap),
  );
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pending, setPending] = useState<QueuedChatMessage[]>(() => pendingChatMessages(roomId));
  const [flushing, setFlushing] = useState(false);
  const flushInFlightRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const mentionIdsRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Map<string, { display_name: string; avatar_url?: string | null }>>(
    new Map(),
  );

  async function ensureName(userIdToLookup: string): Promise<string> {
    if (namesRef.current.has(userIdToLookup)) return namesRef.current.get(userIdToLookup)!;
    let profile = profileCacheRef.current.get(userIdToLookup);
    if (!profile) {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userIdToLookup)
        .maybeSingle();
      profile = data ?? { display_name: "Someone" };
      profileCacheRef.current.set(userIdToLookup, profile);
    }
    const name = profile.display_name ?? "Someone";
    namesRef.current.set(userIdToLookup, name);
    return name;
  }

  // Live messages via postgres_changes (same pattern as thread posts).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "study_room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            body: string;
            created_at: string;
            hidden?: boolean;
            parent_id?: string | null;
          };
          let profile = profileCacheRef.current.get(row.user_id);
          if (!profile) {
            const { data } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", row.user_id)
              .maybeSingle();
            profile = data ?? { display_name: "Unknown" };
            profileCacheRef.current.set(row.user_id, profile);
          }
          // A delivered message confirms any queued copy of it (same body, from me).
          if (row.user_id === userId) {
            const queued = pendingChatMessages(roomId);
            const match = queued.find((m) => m.body === row.body);
            if (match) removeChatMessage(roomId, match.id);
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                ...row,
                room_id: roomId,
                hidden: row.hidden ?? false,
                parent_id: row.parent_id ?? null,
                profiles: profile,
              },
            ];
          });
          if (row.user_id !== userId) void hapticLight();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  // Live reactions via postgres_changes.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room-reactions-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "study_room_message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const row = payload.new as ReactionRow;
          if (!row?.message_id || !row?.emoji) return;
          const name = await ensureName(row.user_id);
          setReactions((prev) => {
            const next = new Map(prev);
            const list = [...(next.get(row.message_id) ?? [])];
            const existing = list.find((s) => s.emoji === row.emoji);
            if (existing) {
              existing.count += 1;
              existing.me = existing.me || row.user_id === userId;
              existing.names.push(name);
            } else {
              list.push({ emoji: row.emoji, count: 1, me: row.user_id === userId, names: [name] });
            }
            next.set(row.message_id, list);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "study_room_message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.old as ReactionRow;
          if (!row?.message_id || !row?.emoji) return;
          setReactions((prev) => {
            const next = new Map(prev);
            const list = [...(next.get(row.message_id) ?? [])];
            const existing = list.find((s) => s.emoji === row.emoji);
            if (!existing) return prev;
            existing.count -= 1;
            if (row.user_id === userId) existing.me = false;
            existing.names = existing.names.filter((n) => n !== namesRef.current.get(row.user_id));
            next.set(row.message_id, list.filter((s) => s.count > 0));
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  // Keep the newest messages in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  // --- Offline queue flush -------------------------------------------------
  const flushQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (flushInFlightRef.current) return;
    flushInFlightRef.current = true;
    setFlushing(true);
    try {
      for (const msg of pendingChatMessages(roomId)) {
        const res = await sendRoomMessage(roomId, msg.body, msg.mentionIds, msg.parentId);
        if (!res.ok) break; // still offline or blocked — keep the rest queued
        removeChatMessage(roomId, msg.id);
      }
    } finally {
      flushInFlightRef.current = false;
      setFlushing(false);
    }
  }, [roomId]);

  // Replay anything queued from a previous session once online, and flush
  // again whenever the connection comes back.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) void flushQueue();
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue]);

  // Keep the pending list in sync with the localStorage queue (covers
  // cross-component changes via the shared event).
  useEffect(() => {
    const sync = () => setPending(pendingChatMessages(roomId));
    window.addEventListener(OFFLINE_ROOM_SYNC_EVENT, sync);
    return () => window.removeEventListener(OFFLINE_ROOM_SYNC_EVENT, sync);
  }, [roomId]);

  // --- Mention autocomplete -------------------------------------------------
  const query = useMemo(() => mentionQuery(text), [text]);
  const matches = useMemo(
    () => (query === null ? [] : filterMentionCandidates(mentionableUsers, query)),
    [query, mentionableUsers],
  );
  const showAutocomplete = query !== null && matches.length > 0 && !disabled;

  function pickMention(user: { id: string; display_name: string }) {
    const idx = text.lastIndexOf("@");
    if (idx === -1) return;
    setText(`${text.slice(0, idx)}@${user.display_name} `);
    mentionIdsRef.current.add(user.id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showAutocomplete && e.key === "Enter") {
      e.preventDefault();
      pickMention(matches[0]);
    }
    if (e.key === "Escape" && showAutocomplete) {
      const idx = text.lastIndexOf("@");
      if (idx !== -1) setText(`${text.slice(0, idx)} `);
    }
    if (e.key === "Escape" && replyTo) setReplyTo(null);
  }

  // --- Sending --------------------------------------------------------------
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setError(null);

    // Plain `@Name` mentions notify by display name too (no picker needed).
    for (const id of extractMentionsFromBody(body, mentionableUsers)) {
      mentionIdsRef.current.add(id);
    }
    const mentionIds = [...mentionIdsRef.current];
    const parentId = replyTo?.id ?? null;

    // Offline — queue locally and render optimistically; flushes on reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueChatMessage(roomId, body, mentionIds, parentId);
      setText("");
      mentionIdsRef.current.clear();
      setPickerFor(null);
      setReplyTo(null);
      void hapticLight();
      return;
    }

    setSending(true);
    try {
      const res = await sendRoomMessage(roomId, body, mentionIds, parentId);
      if (res.ok) {
        setText("");
        mentionIdsRef.current.clear();
        setPickerFor(null);
        setReplyTo(null);
        return;
      }
      // A real rejection (moderation/mute) — surface it, don't retry.
      setError(res.error ?? "Couldn't send the message.");
    } catch {
      // Network failure (or flaky offline detection) — queue for retry.
      queueChatMessage(roomId, body, mentionIds, parentId);
      setText("");
      mentionIdsRef.current.clear();
      setPickerFor(null);
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  }

  // --- Reactions ------------------------------------------------------------
  async function handleToggleReaction(messageId: string, emoji: string) {
    if (disabled) return;
    setPickerFor(null);
    // Optimistic flip; realtime confirms, and we revert by flipping again on error.
    setReactions((prev) => flipLocalReaction(prev, messageId, emoji, myName));
    const res = await toggleReaction(roomId, messageId, emoji);
    if (!res.ok) {
      setReactions((prev) => flipLocalReaction(prev, messageId, emoji, myName));
    }
  }

  // --- Threaded rendering ---------------------------------------------------
  const tree = useMemo(() => buildMessageTree(messages), [messages]);

  function renderNode(node: ChatTreeNode<RoomMessage>, depth: number) {
    const m = node.message;
    const mine = m.user_id === userId;
    const segments = renderMentions(m.body);
    const msgReactions = reactions.get(m.id) ?? [];

    return (
      <div
        key={m.id}
        className={cn(
          "flex flex-col gap-1",
          mine ? "items-end" : "items-start",
          depth > 0 && "ml-7 border-l-2 border-muted pl-3",
        )}
      >
        <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {(m.profiles?.display_name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
            <div className={cn("mb-0.5 flex items-baseline gap-2 text-xs", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {depth > 0 && <CornerUpLeft className="h-3 w-3 opacity-60" />}
              <span className="font-semibold">{mine ? "You" : (m.profiles?.display_name ?? "Unknown")}</span>
              <time>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</time>
            </div>
            <p className="whitespace-pre-wrap break-words">
              {segments.map((seg, i) =>
                seg.mention ? (
                  <span
                    key={i}
                    className={cn(
                      "rounded px-1 font-medium",
                      mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary",
                    )}
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </p>
          </div>
        </div>

        <div className={cn("flex flex-wrap items-center gap-1 pl-9", mine && "pr-9")}>
          {msgReactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              disabled={disabled}
              onClick={() => handleToggleReaction(m.id, r.emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                r.me
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
              title={reactionTooltip(r.names, r.me)}
            >
              <span>{r.emoji}</span>
              <span className="tabular-nums">{r.count}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
            title="Add reaction"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={() => setReplyTo({ id: m.id, name: mine ? "yourself" : (m.profiles?.display_name ?? "this message") })}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-1.5 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              title="Reply"
            >
              <CornerUpLeft className="h-3 w-3" /> Reply
            </button>
          )}
          {pickerFor === m.id && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-0.5">
              {ALLOWED_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToggleReaction(m.id, e)}
                  className="rounded-full p-1 text-sm transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </span>
          )}
          <ReportButton
            targetType="message"
            targetId={m.id}
            compact
            className="rounded-full border border-dashed border-border text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          />
        </div>

        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Room chat</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {messages.length + pending.length} message
          {messages.length + pending.length === 1 ? "" : "s"}
          {flushing ? " · syncing…" : pending.length > 0 ? ` · ${pending.length} queued` : ""}
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: 340 }}>
        {messages.length === 0 && pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages yet — type <span className="font-medium">@name</span> to mention a friend.
          </p>
        ) : (
          <>
          {tree.map((node) => {
            const m = node.message;
            if (m.hidden) {
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs italic text-muted-foreground",
                    m.user_id === userId ? "ml-auto max-w-[80%]" : "mr-auto max-w-[80%]",
                  )}
                >
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  Message removed by moderators for violating community guidelines
                </div>
              );
            }
            return renderNode(node, 0);
          })}
          {pending.map((p) => (
            <div key={`pending-${p.id}`} className="flex flex-col items-end gap-1 opacity-60">
              <div className="max-w-[80%] rounded-lg bg-primary/70 px-3 py-2 text-sm text-primary-foreground">
                <div className="mb-0.5 flex items-center gap-1.5 text-xs text-primary-foreground/80">
                  <CloudOff className="h-3 w-3" />
                  <span className="font-semibold">You</span>
                  <span>· queued</span>
                  {p.parentId && (
                    <span className="inline-flex items-center gap-0.5">
                      <CornerUpLeft className="h-3 w-3" /> reply
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">{p.body}</p>
              </div>
            </div>
          ))}
          </>
        )}
      </div>

      {showAutocomplete && (
        <div className="absolute bottom-16 left-3 right-3 z-20 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Mention someone
          </p>
          {matches.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pickMention(u)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                {u.display_name.charAt(0).toUpperCase()}
              </span>
              {u.display_name}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="border-t p-2.5">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
            <CornerUpLeft className="h-3.5 w-3.5 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              Replying to <span className="font-semibold">{replyTo.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={ROOM_MESSAGE_MAX_LENGTH}
            placeholder={
              disabled
                ? "Room ended"
                : banned
                  ? "You've been removed from this room"
                  : muted
                    ? "You're muted in this room"
                    : "Message the room… (@ to mention)"
            }
            disabled={disabled || muted || banned || sending}
            className="h-9"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9"
            disabled={disabled || muted || banned || sending || !text.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}