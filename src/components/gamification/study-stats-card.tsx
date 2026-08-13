"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, Star, Trophy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { dailyCheckIn } from "@/actions/gamification";
import { xpToLevel, levelProgress } from "@/lib/gamification";
import { hapticSuccess } from "@/lib/haptics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LeaderboardEntry, UserStats } from "@/types/database";
import { cn } from "@/lib/utils";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function StudyStatsCard({
  userId,
  initialStats,
  initialLeaderboard,
}: {
  userId: string;
  initialStats: UserStats | null;
  initialLeaderboard: LeaderboardEntry[];
}) {
  const [stats, setStats] = useState<UserStats | null>(initialStats);
  const [leaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard);
  const [checkingIn, setCheckingIn] = useState(false);

  const checkedInToday = stats?.daily_checkin_date === todayString();
  const totalXp = stats?.total_xp ?? 0;
  const { current, next, pct } = levelProgress(totalXp);
  const level = xpToLevel(totalXp);

  async function handleCheckIn() {
    setCheckingIn(true);
    const res = await dailyCheckIn();
    setCheckingIn(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const data = res.data;
    if (data) {
      void hapticSuccess();
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total_xp: data.total_xp,
              current_streak: data.current_streak,
              longest_streak: data.longest_streak,
              daily_checkin_date: todayString(),
            }
          : prev,
      );
      toast.success(
        data.already_checked_in
          ? "You've already checked in today — come back tomorrow to keep your streak!"
          : `Checked in! +5 XP → Level ${data.level} · ${data.current_streak}-day streak`,
      );
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Study Stats</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3 w-3" />
            Level {level}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats ? (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{totalXp.toLocaleString()} XP</span>
                  <span className="text-muted-foreground">
                    {current}/{next} XP to level {level + 1}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg border border-border p-3">
                  <Flame className="mx-auto mb-1 h-5 w-5 text-orange-500" />
                  <p className="text-2xl font-bold">{stats.current_streak}</p>
                  <p className="text-xs text-muted-foreground">day streak</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <Trophy className="mx-auto mb-1 h-5 w-5 text-amber-500" />
                  <p className="text-2xl font-bold">{stats.longest_streak}</p>
                  <p className="text-xs text-muted-foreground">longest streak</p>
                </div>
              </div>

              <Button
                onClick={handleCheckIn}
                disabled={checkedInToday || checkingIn}
                className="w-full gap-2"
              >
                {checkedInToday ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Checked in today
                  </>
                ) : (
                  <>Daily check-in (+5 XP)</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Study for consecutive days to grow your streak — bonus XP kicks in from day 2.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No study activity yet. Master flashcards, share materials, and check in daily to
              start earning XP and building your streak.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Leaderboard</CardTitle>
          <Trophy className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent className="space-y-1.5">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ranked students yet — be the first to earn XP.</p>
          ) : (
            leaderboard.map((entry, i) => {
              const isMe = entry.user_id === userId;
              return (
                <div
                  key={entry.user_id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm",
                    isMe && "bg-primary/5 border-primary/20",
                  )}
                >
                  <span className={cn("w-5 text-center font-bold", i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-muted-foreground")}>
                    {i + 1}
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
                  <span className="text-xs text-muted-foreground">Lv {entry.level}</span>
                  <span className="font-semibold tabular-nums">{entry.total_xp.toLocaleString()} XP</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
