"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { getQuizLeaderboard, type QuizAttemptRow } from "@/actions/quizzes";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const RANK_META: Record<number, { icon: typeof Trophy; label: string; className: string }> = {
  1: { icon: Trophy, label: "1st", className: "text-amber-500" },
  2: { icon: Medal, label: "2nd", className: "text-slate-400" },
  3: { icon: Medal, label: "3rd", className: "text-orange-700" },
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

export function QuizLeaderboard({ materialId }: { materialId: string }) {
  const [rows, setRows] = useState<QuizAttemptRow[] | null>(null);
  const [mine, setMine] = useState<QuizAttemptRow | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await getQuizLeaderboard(materialId);
      if (!active) return;
      setRows(res.rows);
      setMine(res.mine);
    }
    void load();
    return () => {
      active = false;
    };
  }, [materialId]);

  if (!rows) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold">Community leaderboard</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody has taken this quiz yet — be the first!
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const meta = RANK_META[i + 1];
            const isMine = mine?.user_id === r.user_id;
            return (
              <li
                key={r.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5",
                  isMine && "bg-primary/10 ring-1 ring-primary/20",
                )}
              >
                {meta ? (
                  <meta.icon className={cn("h-4 w-4 shrink-0", meta.className)} />
                ) : (
                  <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <Avatar className="h-6 w-6">
                  {r.profiles?.avatar_url ? (
                    <AvatarImage src={r.profiles.avatar_url} alt={r.profiles.display_name} />
                  ) : (
                    <AvatarFallback className="text-[9px]">
                      {initials(r.profiles?.display_name ?? "?")}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.profiles?.display_name ?? "Anonymous"}
                  {isMine && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                </span>
                <span className="text-sm font-semibold">{r.best_score_pct}%</span>
                <span className="w-14 text-right text-xs text-muted-foreground">
                  {r.best_correct}/{r.best_total}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {mine && !rows.some((r) => r.user_id === mine.user_id) && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-dashed border-border px-2 py-1.5 text-sm">
          <span className="text-muted-foreground">Your best</span>
          <span className="font-semibold">
            {mine.best_score_pct}% · {mine.best_correct}/{mine.best_total} ·{" "}
            {mine.attempts} attempt{mine.attempts === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}
