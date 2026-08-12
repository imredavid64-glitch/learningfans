"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  countDueCards,
  FLASHCARD_UPDATE_EVENT,
} from "@/lib/flashcard-storage";
import { Users } from "lucide-react";

type PresencePayload = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  due_count?: number;
};

function useDueCardCount(materialId: string): number {
  const [count, setCount] = useState(() => countDueCards(materialId));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setCount(countDueCards(materialId));
    window.addEventListener(FLASHCARD_UPDATE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FLASHCARD_UPDATE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [materialId]);

  return count;
}

export function StudyRoomPresence({
  materialId,
  userId,
  displayName,
  avatarUrl,
}: {
  materialId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}) {
  const [present, setPresent] = useState<PresencePayload[]>([]);
  const dueCount = useDueCardCount(materialId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [ready, setReady] = useState(false);

  // Subscribe once.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`study-room-${materialId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const sync = () => {
      const state = channel.presenceState();
      const seen = new Set<string>();
      const users: PresencePayload[] = [];
      for (const key of Object.keys(state)) {
        for (const presence of state[key] as unknown as PresencePayload[]) {
          if (!presence?.user_id || seen.has(presence.user_id)) continue;
          seen.add(presence.user_id);
          users.push(presence);
        }
      }
      setPresent(users);
    };

    channel.on("presence", { event: "sync" }, sync).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          display_name: displayName,
          avatar_url: avatarUrl ?? null,
          due_count: 0,
        });
        setReady(true);
      }
    });

    return () => {
      setReady(false);
      channelRef.current = null;
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [materialId, userId, displayName, avatarUrl]);

  // Re-track whenever the local due count changes (a card was reviewed).
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !ready) return;
    void channel.track({
      user_id: userId,
      display_name: displayName,
      avatar_url: avatarUrl ?? null,
      due_count: dueCount,
    });
  }, [dueCount, ready, userId, displayName, avatarUrl]);

  if (present.length === 0) return null;

  const others = present.filter((p) => p.user_id !== userId);
  const totalDue = present.reduce((sum, p) => sum + (p.due_count ?? 0), 0);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Users className="h-4 w-4" />
        <strong className="text-foreground">{present.length}</strong>
        {present.length === 1 ? "person is" : "people are"} studying right now
        {totalDue > 0 && (
          <span className="text-xs text-foreground">· <strong>{totalDue}</strong> card{totalDue === 1 ? " is" : "s are"} due across the room</span>
        )}
      </span>
      <span className="flex -space-x-2">
        {present.slice(0, 8).map((p) => (
          <span
            key={p.user_id}
            title={`${p.display_name}${(p.due_count ?? 0) > 0 ? ` (${p.due_count} due)` : ""}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-semibold text-primary"
          >
            {p.display_name.charAt(0).toUpperCase()}
          </span>
        ))}
      </span>
      {others.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {others.map((o) => `${o.display_name}${(o.due_count ?? 0) > 0 ? ` (${o.due_count} due)` : ""}`).join(", ")}
        </span>
      )}
    </div>
  );
}
