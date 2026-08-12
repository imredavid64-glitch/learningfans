"use client";

import { useMemo, useState } from "react";
import { Flame, Medal, MessageSquare, Trophy } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface LeaderboardRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  xp: number;
  level: number;
  streak: number;
  threads: number;
  materials: number;
  replies: number;
  contributions: number;
  isMe: boolean;
}

type SortKey = "xp" | "contributions";

const MEDALS: Record<number, { icon: typeof Trophy; className: string }> = {
  1: { icon: Trophy, className: "text-amber-500" },
  2: { icon: Medal, className: "text-slate-400" },
  3: { icon: Medal, className: "text-orange-700" },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CommunityLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [sort, setSort] = useState<SortKey>("xp");

  const ranked = useMemo(() => {
    return [...rows].sort((a, b) =>
      sort === "xp"
        ? b.xp - a.xp || b.contributions - a.contributions
        : b.contributions - a.contributions || b.xp - a.xp,
    );
  }, [rows, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "xp", label: "By XP" },
            { id: "contributions", label: "By contributions" },
          ] as { id: SortKey; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              sort === s.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No members yet — join the community to see the leaderboard.
        </p>
      ) : (
        <ol className="space-y-2">
          {ranked.map((row, i) => {
            const medal = MEDALS[i + 1];
            return (
              <li
                key={row.userId}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
                  row.isMe && "border-primary/40 bg-primary/5",
                )}
              >
                {medal ? (
                  <medal.icon className={cn("h-5 w-5 shrink-0", medal.className)} />
                ) : (
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <Avatar className="h-9 w-9">
                  {row.avatarUrl ? (
                    <AvatarImage src={row.avatarUrl} alt={row.name} />
                  ) : (
                    <AvatarFallback className="text-xs">{initials(row.name)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {row.name}
                    {row.isMe && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                    {row.role === "moderator" && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        Mod
                      </Badge>
                    )}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Level {row.level} · {row.xp.toLocaleString()} XP
                    </span>
                    {row.streak > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                        <Flame className="h-3 w-3" /> {row.streak}
                      </span>
                    )}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <p>
                    {row.threads} threads · {row.materials} materials
                  </p>
                  <p className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {row.replies} replies
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold">
                    {sort === "xp" ? `${row.xp.toLocaleString()} XP` : `${row.contributions} contrib`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
