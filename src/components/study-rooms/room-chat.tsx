"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { sendRoomMessage } from "@/actions/study-rooms";
import { ROOM_MESSAGE_MAX_LENGTH } from "@/lib/study-room-utils";
import { hapticLight } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string; avatar_url?: string | null } | null;
}

interface RoomChatProps {
  roomId: string;
  userId: string;
  initialMessages: RoomMessage[];
  disabled?: boolean;
}

export function RoomChat({ roomId, userId, initialMessages, disabled }: RoomChatProps) {
  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const profileCacheRef = useRef<Map<string, { display_name: string; avatar_url?: string | null }>>(
    new Map(),
  );

  // Live updates via postgres_changes (same pattern as thread posts).
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
          const row = payload.new as { id: string; user_id: string; body: string; created_at: string };
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              { ...row, room_id: roomId, profiles: profile },
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

  // Keep the newest messages in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const res = await sendRoomMessage(roomId, body);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send the message.");
      return;
    }
    setText("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Room chat</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" style={{ maxHeight: 340 }}>
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages yet — say hi and share what you&apos;re working on.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {(m.profiles?.display_name ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className={`mb-0.5 flex items-baseline gap-2 text-xs ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    <span className="font-semibold">{mine ? "You" : (m.profiles?.display_name ?? "Unknown")}</span>
                    <time>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</time>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t p-2.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={ROOM_MESSAGE_MAX_LENGTH}
          placeholder={disabled ? "Room ended" : "Message the room…"}
          disabled={disabled || sending}
          className="h-9"
        />
        <Button type="submit" size="icon" className="h-9 w-9" disabled={disabled || sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
