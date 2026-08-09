"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Check, Lock } from "lucide-react";

const ACHIEVEMENT_ICONS: Record<string, string> = {
  check: "✓", target: "🎯", star: "⭐", timer: "⏱", fire: "🔥",
  card: "🃏", note: "📝", quiz: "📝", chart: "📊", ai: "🤖",
  book: "📚", voice: "💬",
};

interface StudyHubUser {
  name?: string;
  major?: string;
  weekly_target_hours?: number;
}

interface StudyHubAchievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  earned: boolean;
}

interface StudyHubCalendarEvent {
  id?: string;
  title: string;
  date?: string;
  time?: string;
  desc?: string;
}

interface StudyHubGoal {
  id: string;
  title: string;
  subject?: string;
  deadline?: string;
  hours?: number;
  priority?: string;
}

interface StudyHubTask {
  id: string;
  title: string;
  status?: string;
  due?: string;
}

interface StudyHubProfile {
  name?: string;
  major?: string;
  weeklyTargetHours?: number;
}

interface StudyHubSettings {
  studyMode?: string;
}

interface StudyHubStateData {
  calendarEvents?: StudyHubCalendarEvent[];
  goals?: StudyHubGoal[];
  tasks?: StudyHubTask[];
  profile?: StudyHubProfile;
  settings?: StudyHubSettings;
}

interface StudyHubResponse {
  status: string;
  user: StudyHubUser | null;
  state?: { state_data?: StudyHubStateData; last_updated?: string } | null;
  achievements?: StudyHubAchievement[];
  error?: string;
  message?: string;
}

export function StudyHubData() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StudyHubResponse | null>(null);
  const [error, setError] = useState("");

  async function fetchData() {
    if (!userId.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/study-hub?userId=${encodeURIComponent(userId.trim())}&action=data`);
      const json = await res.json();
      if (json.status === "needs_migration") {
        setError(json.message);
      } else if (json.status === "ok") {
        setData(json);
      } else {
        setError(json.error || "Failed to load data");
      }
    } catch {
      setError("Failed to connect to Study Hub");
    } finally {
      setLoading(false);
    }
  }

  const state = data?.state?.state_data;
  const user = data?.user;
  const achievements: StudyHubAchievement[] = data?.achievements || [];
  const calendarEvents: StudyHubCalendarEvent[] = state?.calendarEvents || [];
  const goals: StudyHubGoal[] = state?.goals || [];
  const tasks: StudyHubTask[] = state?.tasks || [];
  const profile: StudyHubProfile = state?.profile || {};
  const settings: StudyHubSettings = state?.settings || {};
  const earnedCount = achievements.filter((a) => a.earned).length;
  const totalCount = achievements.length;
  const pct = totalCount > 0 ? Math.round(earnedCount / totalCount * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter your Study Hub User ID</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Find your User ID in Study Hub → Settings → scroll to the bottom. It looks like <code>user_xxx</code>.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="e.g. user_a1b2c3d4"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <Button onClick={fetchData} disabled={loading || !userId.trim()}>
              {loading ? "Loading..." : "Load data"}
            </Button>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-sm text-muted-foreground">Name</span>
              <p className="font-medium">{profile.name || user.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Major</span>
              <p className="font-medium">{profile.major || user.major}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Study Mode</span>
              <p className="font-medium capitalize">{settings.studyMode || "—"}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Weekly Target</span>
              <p className="font-medium">{profile.weeklyTargetHours || user.weekly_target_hours || "—"} hrs</p>
            </div>
          </CardContent>
        </Card>
      )}

      {achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-lg font-bold text-primary">{earnedCount}/{totalCount}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground font-semibold">{pct}%</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition-all ${
                    a.earned ? "" : "opacity-50"
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{ACHIEVEMENT_ICONS[a.icon] || "🏆"}</span>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-sm">{a.title}</strong>
                    <p className="text-xs text-muted-foreground m-0">{a.desc}</p>
                  </div>
                  <span className="flex-shrink-0">
                    {a.earned
                      ? <Check className="h-4 w-4 text-primary" />
                      : <Lock className="h-4 w-4 text-muted-foreground" />}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {calendarEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline">{calendarEvents.length}</Badge>
              Calendar Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calendarEvents.map((ev, i) => (
              <div key={ev.id || i} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-muted-foreground">
                    {ev.date}{ev.time ? ` · ${ev.time}` : ""}
                  </p>
                </div>
                {ev.desc && (
                  <p className="text-xs text-muted-foreground max-w-[200px] truncate">{ev.desc}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline">{goals.length}</Badge>
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{g.title}</p>
                  {g.subject && <Badge variant="secondary">{g.subject}</Badge>}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {g.deadline && <span>Due: {new Date(g.deadline).toLocaleDateString()}</span>}
                  {g.hours && <span>{g.hours}h planned</span>}
                  <span className="capitalize">Priority: {g.priority}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline">{tasks.length}</Badge>
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    t.status === "done" ? "bg-green-500" :
                    t.status === "in-progress" ? "bg-amber-500" : "bg-muted"
                  }`} />
                  <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>
                    {t.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t.due ? new Date(t.due).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!data && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto h-8 w-8 mb-3 opacity-50" />
            Enter your Study Hub User ID above to see your data.
            <br />
            First time? Open{" "}
            <a href="https://study-hub-plum-omega.vercel.app" target="_blank" rel="noreferrer"
               className="text-primary underline">Study Hub</a>
            , go to Settings, and check your User ID at the bottom.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
