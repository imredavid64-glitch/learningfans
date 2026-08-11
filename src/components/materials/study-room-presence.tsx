"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users } from "lucide-react";

type PresencePayload = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
};

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

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`study-room-${materialId}`, {
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

    channel.on("presence", { event: "sync" }, sync).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          display_name: displayName,
          avatar_url: avatarUrl ?? null,
        });
      }
    });

    return () => {
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [materialId, userId, displayName, avatarUrl]);

  if (present.length === 0) return null;

  const others = present.filter((p) => p.user_id !== userId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Users className="h-4 w-4" />
        <strong className="text-foreground">{present.length}</strong>
        {present.length === 1 ? "person is" : "people are"} studying right now
      </span>
      <span className="flex -space-x-2">
        {present.slice(0, 8).map((p) => (
          <span
            key={p.user_id}
            title={p.display_name}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-semibold text-primary"
          >
            {p.display_name.charAt(0).toUpperCase()}
          </span>
        ))}
      </span>
      {others.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {others.map((o) => o.display_name).join(", ")}
        </span>
      )}
    </div>
  );
}
