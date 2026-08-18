import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyLeaderboardEntry } from "@/actions/gamification";
import { cn } from "@/lib/utils";

const MEDAL_COLORS = ["text-amber-500", "text-slate-400", "text-orange-600"];

export function WallOfFame({
  entries,
  userId,
}: {
  entries: WeeklyLeaderboardEntry[];
  userId: string;
}) {
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            Wall of Fame
          </CardTitle>
          <CardDescription>This week&apos;s top XP earners</CardDescription>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          Weekly
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry, i) => {
          const isMe = entry.user_id === userId;
          return (
            <div
              key={entry.user_id}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm",
                i < 3 && "border-amber-500/30 bg-amber-500/5",
                isMe && "border-primary/30 bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "text-lg font-bold",
                  i < 3 ? MEDAL_COLORS[i] : "text-muted-foreground",
                )}
              >
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {entry.display_name.charAt(0).toUpperCase()}
              </span>
              <Link
                href={`/app/profile/${entry.user_id}`}
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {entry.display_name}
                {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
              </Link>
              <span className="text-xs text-muted-foreground">
                {entry.weekly_xp.toLocaleString()} XP
              </span>
              <span className="text-xs text-muted-foreground">this week</span>
            </div>
          );
        })}
        {entries.length > 0 && (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            Weekly totals reset every Monday — check in and study to claim a spot.
          </p>
        )}
      </CardContent>
    </Card>
  );
}