"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studyRoomChannel } from "@/lib/study-room-utils";
import { moderateRoomMember } from "@/actions/study-rooms";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Ban, Loader2, MicOff, ShieldCheck, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModerationRow = {
  user_id: string;
  action: "mute" | "ban";
  expires_at: string | null;
};

type PresencePayload = {
  user_id: string;
  display_name: string;
};

export function RoomModeration({
  roomId,
  userId,
  isHost,
  initialModeration,
}: {
  roomId: string;
  userId: string;
  isHost: boolean;
  initialModeration: ModerationRow[];
}) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<PresencePayload[]>([]);
  const [moderation, setModeration] = useState<ModerationRow[]>(initialModeration);
  const [busy, setBusy] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => new Date().getTime());

  // Refresh the clock periodically so muted badges clear themselves when a
  // mute window expires.
  useEffect(() => {
    const id = setInterval(() => setNowMs(new Date().getTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Live participant list via presence (same channel as RoomPresence).
  useEffect(() => {
    if (!isHost) return;
    const supabase = createClient();
    const channel = supabase.channel(studyRoomChannel(roomId), {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState();
      const seen = new Set<string>();
      const users: PresencePayload[] = [];
      for (const key of Object.keys(state)) {
        for (const p of state[key] as unknown as PresencePayload[]) {
          if (!p?.user_id || seen.has(p.user_id)) continue;
          seen.add(p.user_id);
          users.push(p);
        }
      }
      setPresent(users);
    };

    channel.on("presence", { event: "sync" }, sync).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, isHost]);

  async function act(targetUserId: string, action: "mute" | "unmute" | "ban" | "unban") {
    setBusy(`${targetUserId}:${action}`);
    const res = await moderateRoomMember(roomId, targetUserId, action);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't update the participant.");
      return;
    }
    // Reflect the change locally; the server row is the source of truth.
    setModeration((prev) => {
      const rest = prev.filter((m) => m.user_id !== targetUserId);
      if (action === "unmute" || action === "unban") return rest;
      return [
        ...rest,
        {
          user_id: targetUserId,
          action: action === "mute" ? "mute" : "ban",
          expires_at: action === "mute" ? null : null,
        },
      ];
    });
    toast.success(action === "unmute" || action === "unban" ? "Participant restored." : "Participant moderated.");
  }

  if (!isHost) return null;

  const others = present.filter((p) => p.user_id !== userId);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        <ShieldCheck className="h-3.5 w-3.5" /> Moderate
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border bg-popover p-2 shadow-lg">
          <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Participants
          </p>
          {others.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No one else is in the room right now.
            </p>
          ) : (
            <ul className="space-y-1">
              {others.map((p) => {
                const mod = moderation.find((m) => m.user_id === p.user_id);
                const banned = mod?.action === "ban";
                const muted =
                  mod?.action === "mute" &&
                  (!mod.expires_at || new Date(mod.expires_at).getTime() > nowMs);
                return (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {p.display_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.display_name}
                      {banned && <span className="ml-1 text-xs text-destructive">(banned)</span>}
                      {muted && <span className="ml-1 text-xs text-amber-600">(muted)</span>}
                    </span>
                    {busy === `${p.user_id}:mute` || busy === `${p.user_id}:unmute` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <button
                        type="button"
                        disabled={banned}
                        onClick={() => act(p.user_id, muted ? "unmute" : "mute")}
                        className={cn(
                          "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent",
                          banned && "opacity-40",
                        )}
                        title={muted ? "Unmute" : "Mute for 10 minutes"}
                      >
                        {muted ? <Volume2 className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {busy === `${p.user_id}:ban` || busy === `${p.user_id}:unban` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => act(p.user_id, banned ? "unban" : "ban")}
                        className={cn(
                          "rounded-md p-1.5 transition-colors hover:bg-accent",
                          banned ? "text-green-600" : "text-destructive",
                        )}
                        title={banned ? "Unban" : "Ban from the room"}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
