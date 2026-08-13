"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAccountabilityGroup,
  joinAccountabilityGroup,
  leaveAccountabilityGroup,
  checkInGroup,
  nudgeMember,
} from "@/actions/accountability";
import {
  checkedInSince,
  groupStreak,
  weeklyProgress,
  weekStart,
  utcDateKey,
  type GroupCheckin,
} from "@/lib/accountability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Flame, Hand, Plus, CheckCircle2, LogIn, LogOut } from "lucide-react";

type Group = {
  id: string;
  name: string;
  weekly_goal: string;
  created_by: string;
  created_at: string;
  members: { user_id: string; display_name: string }[];
  checkins: GroupCheckin[];
};

export function AccountabilityGroups({
  userId,
  groups,
  now: nowIso,
}: {
  userId: string;
  groups: Group[];
  now: string;
}) {
  const router = useRouter();
  const now = new Date(nowIso);
  const todayKey = utcDateKey(now);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await createAccountabilityGroup(name, goal);
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't create the group.");
      return;
    }
    toast.success("Group created — you're in!");
    setName("");
    setGoal("");
    router.refresh();
  }

  async function handleJoin(groupId: string) {
    setBusy(`join:${groupId}`);
    const res = await joinAccountabilityGroup(groupId);
    setBusy(null);
    if (!res.ok) toast.error(res.error ?? "Couldn't join.");
    router.refresh();
  }

  async function handleLeave(groupId: string) {
    setBusy(`leave:${groupId}`);
    const res = await leaveAccountabilityGroup(groupId);
    setBusy(null);
    if (!res.ok) toast.error(res.error ?? "Couldn't leave.");
    router.refresh();
  }

  async function handleCheckIn(groupId: string) {
    setBusy(`checkin:${groupId}`);
    const res = await checkInGroup(groupId);
    setBusy(null);
    if (!res.ok) toast.error(res.error ?? "Couldn't check in.");
    else if (res.alreadyCheckedIn) toast.success("Already checked in today — nice consistency!");
    else toast.success("Checked in! Keep it up.");
    router.refresh();
  }

  async function handleNudge(groupId: string, targetUserId: string) {
    setBusy(`nudge:${groupId}:${targetUserId}`);
    const res = await nudgeMember(groupId, targetUserId);
    setBusy(null);
    if (!res.ok) toast.error(res.error ?? "Couldn't nudge.");
    else toast.success("Nudge sent!");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a group</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group name</Label>
              <Input
                id="groupName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Unit 3 study squad"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupGoal">Weekly goal</Label>
              <Input
                id="groupGoal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder='e.g. "Finish Unit 3"'
                maxLength={200}
                required
              />
            </div>
            <Button type="submit" disabled={creating} className="gap-2">
              <Plus className="h-4 w-4" />
              {creating ? "Creating…" : "Create group"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Group list */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No groups yet. Start one and invite a couple of friends!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const isMember = g.members.some((m) => m.user_id === userId);
            const checked = checkedInSince(
              g.members.map((m) => m.user_id),
              g.checkins,
              weekStart(now),
            );
            const pct = Math.round(weeklyProgress(g.members.map((m) => m.user_id), g.checkins, now) * 100);
            const streak = groupStreak(g.members.map((m) => m.user_id), g.checkins, now);
            const myCheckinDate = g.checkins.find(
              (c) => c.user_id === userId && c.checkin_date === todayKey,
            );

            return (
              <Card key={g.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{g.name}</CardTitle>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        🎯 {g.weekly_goal}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      {streak} day streak
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {checked.size}/{g.members.length} checked in this week
                      </span>
                      <span className="font-medium tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Members */}
                  <ul className="space-y-1.5">
                    {g.members.map((m) => {
                      const didCheckIn = checked.has(m.user_id);
                      const isMe = m.user_id === userId;
                      return (
                        <li key={m.user_id} className="flex items-center gap-2 text-sm">
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary",
                              didCheckIn && "bg-green-500/15 text-green-600",
                            )}
                          >
                            {didCheckIn ? <CheckCircle2 className="h-3.5 w-3.5" /> : m.display_name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {m.display_name}
                            {isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                          </span>
                          {isMember && !isMe && (
                            <button
                              type="button"
                              disabled={busy === `nudge:${g.id}:${m.user_id}`}
                              onClick={() => handleNudge(g.id, m.user_id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              title="Send a gentle nudge"
                            >
                              <Hand className="h-3.5 w-3.5" /> Nudge
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Actions */}
                  {isMember ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={Boolean(myCheckinDate) || busy === `checkin:${g.id}`}
                        onClick={() => handleCheckIn(g.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {myCheckinDate ? "Checked in today" : "Check in"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={busy === `leave:${g.id}`}
                        onClick={() => handleLeave(g.id)}
                      >
                        <LogOut className="h-4 w-4" /> Leave
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      disabled={busy === `join:${g.id}`}
                      onClick={() => handleJoin(g.id)}
                    >
                      <LogIn className="h-4 w-4" /> Join group
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
