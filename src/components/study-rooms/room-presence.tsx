"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studyRoomChannel } from "@/lib/study-room-utils";
import { Users } from "lucide-react";

type PresencePayload = {
  user_id: string;
  display_name: string;
};

export function RoomPresence({
  roomId,
  userId,
  displayName,
}: {
  roomId: string;
  userId: string;
  displayName: string;
}) {
  const [present, setPresent] = useState<PresencePayload[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(studyRoomChannel(roomId), {
      config: { presence: { key: userId } },
    });

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

    channel
      .on("presence", { event: "sync" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, display_name: displayName });
        }
      });

    return () => {
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, displayName]);

  if (present.length === 0) return null;

  const others = present.filter((p) => p.user_id !== userId);

  return (
    <div className="flex flex-wrap items-center gap-2" title={others.map((o) => o.display_name).join(", ")}>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <strong className="text-foreground">{present.length}</strong>
        {present.length === 1 ? "person" : "people"} in the room
      </span>
      <span className="flex -space-x-2">
        {present.slice(0, 6).map((p) => (
          <span
            key={p.user_id}
            title={`${p.display_name}${p.user_id === userId ? " (you)" : ""}`}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-semibold text-primary ${
              p.user_id === userId ? "ring-2 ring-primary/40" : ""
            }`}
          >
            {p.display_name.charAt(0).toUpperCase()}
          </span>
        ))}
      </span>
    </div>
  );
}
