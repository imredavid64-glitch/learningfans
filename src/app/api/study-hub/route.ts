import { NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SH_PROJECT = process.env.STUDY_HUB_PROJECT || "nnrdkdisjfudibvrggxb";
const SH_URL = `https://${SH_PROJECT}.supabase.co`;
const SH_SERVICE_KEY = process.env.STUDY_HUB_SERVICE_KEY || "";
const SH_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Scholar',
  major TEXT DEFAULT 'General Studies',
  weekly_target_hours INTEGER DEFAULT 20,
  target_gpa REAL DEFAULT 3.8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_state_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_data JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  source TEXT DEFAULT 'frontend',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_state_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_access_snapshots" ON user_state_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_access_events" ON analytics_events FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_events;
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON user_state_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_last_updated ON user_state_snapshots(last_updated);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp);
`;

async function shFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SH_URL}${path}`, {
    ...options,
    headers: {
      apikey: SH_SERVICE_KEY,
      Authorization: `Bearer ${SH_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

function computeAchievements(s: any) {
  // s: State snapshot data from Study Hub (all any type due to dynamic schema)
  // Next major schema migration expected (removed Study Hub DB, REST API only for now)
  const tasks = s.tasks || [];
  const sessions = s.sessions || [];
  const flashcards = s.flashcards || [];
  const quizAttempts = s.quizAttempts || [];
  const notes = s.notes || [];
  const aiChatHistory = s.aiChatHistory || [];
  const mockTestHistory = s.mockTestHistory || [];
  const ach = s.settings?._ach || {};

  const doneTasks = tasks.filter((t: any) => t.status === "done");
  const sessionDates = sessions.map((s: any) => s.date).filter(Boolean);
  const uniqueDates = [...new Set(sessionDates.map((d: string) => d.split("T")[0]))].sort().reverse();
  let streakCache = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const check = new Date(today);
    for (const dStr of uniqueDates) {
      const d = new Date(dStr + "T00:00:00");
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === check.getTime()) {
        streakCache++;
        check.setDate(check.getDate() - 1);
      } else if (d.getTime() === check.getTime() + 86400000) {
        streakCache++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const totalMinutes = sessions.reduce((t: number, x: any) => t + (x.minutes || 0), 0);
  const ratedCards = flashcards.filter((f: any) => (f.interval || 0) > 1).length;

  let toolsUsed = 0;
  if (flashcards.length >= 3) toolsUsed++;
  if (quizAttempts.length >= 3) toolsUsed++;
  if (notes.length >= 3) toolsUsed++;
  if (sessions.length >= 5) toolsUsed++;

  return [
    { id: "firstTask", title: "First Task", desc: "Complete your first task", icon: "check",
      earned: doneTasks.length >= 1 },
    { id: "taskTen", title: "Task Crusher", desc: "Complete 10 tasks", icon: "target",
      earned: doneTasks.length >= 10 },
    { id: "goalOne", title: "Goal Down", desc: "Complete your first goal", icon: "target",
      earned: (ach.goalsCompleted || 0) >= 1 },
    { id: "goalThree", title: "Goal Crusher", desc: "Complete 3 goals", icon: "target",
      earned: (ach.goalsCompleted || 0) >= 3 },
    { id: "perfectQuiz", title: "Perfect Score", desc: "Get 100% on a quiz", icon: "star",
      earned: quizAttempts.some((a: any) => a.score === a.total) },
    { id: "streakThree", title: "On Fire", desc: "Study 3 days in a row", icon: "timer",
      earned: streakCache >= 3 },
    { id: "streakSeven", title: "Week Warrior", desc: "Study 7 days in a row", icon: "fire",
      earned: streakCache >= 7 },
    { id: "flashcardsTen", title: "Flashcard Fan", desc: "Create 10 flashcards", icon: "card",
      earned: flashcards.length >= 10 },
    { id: "notesThree", title: "Note Taker", desc: "Create 3 notes", icon: "note",
      earned: notes.length >= 3 },
    { id: "quizThree", title: "Quiz Explorer", desc: "Take 3 quizzes", icon: "quiz",
      earned: quizAttempts.length >= 3 },
    { id: "sessionFirst", title: "First Session", desc: "Log your first study session", icon: "timer",
      earned: sessions.length >= 1 },
    { id: "centuryMin", title: "Century Mark", desc: "Study 100+ total minutes", icon: "chart",
      earned: totalMinutes >= 100 },
    { id: "aiChatter", title: "AI Explorer", desc: "Chat with AI Tutor 5 times", icon: "ai",
      earned: aiChatHistory.length >= 5 },
    { id: "reflections", title: "Self Reflector", desc: "Log 5 daily reflections", icon: "note",
      earned: (ach.reflectionsCount || 0) >= 5 },
    { id: "planned", title: "Planned Ahead", desc: "Generate a study plan", icon: "book",
      earned: (ach.studyPlansGenerated || 0) >= 1 },
    { id: "earlyBird", title: "Early Bird", desc: "Finish a task before its due date", icon: "check",
      earned: (ach.earlyTasks || 0) >= 1 },
    { id: "flashcardRate", title: "Card Shark", desc: "Rate 10 flashcards after review", icon: "card",
      earned: ratedCards >= 10 },
    { id: "wellRounded", title: "Well Rounded", desc: "Use 4 different study tools", icon: "star",
      earned: toolsUsed >= 4 },
    { id: "mockMaster", title: "Mock Master", desc: "Complete a mock test", icon: "quiz",
      earned: mockTestHistory.length >= 1 },
    { id: "socialStart", title: "Social Start", desc: "Connect with the community tab", icon: "voice",
      earned: true },
  ];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const action = searchParams.get("action") || "status";

  if (!SH_SERVICE_KEY) {
    return NextResponse.json({ status: "error", message: "STUDY_HUB_SERVICE_KEY not configured" }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Study Hub user ID required (get it from Study Hub → Settings)" }, { status: 400 });
  }

  // Check if tables exist
  const { ok: tablesExist } = await shFetch("/rest/v1/user_state_snapshots?select=id&limit=1");

  if (!tablesExist) {
    return NextResponse.json({
      status: "needs_migration",
      message: "Study Hub database needs setup. Visit Study Hub → Settings → Cloud Sync to sync your data.",
    });
  }

  if (action === "data") {
    const { data: userRecords } = await shFetch(`/rest/v1/users?id=eq.${userId}`);

    const { data: snapshots } = await shFetch(
      `/rest/v1/user_state_snapshots?user_id=eq.${userId}&select=state_data,last_updated`,
    );

    const stateData = snapshots?.[0]?.state_data || {};
    const achievements = computeAchievements(stateData);

    return NextResponse.json({
      status: "ok",
      user: userRecords?.[0] || null,
      state: snapshots?.[0] || null,
      achievements,
    });
  }

  // List available users
  const { data: users } = await shFetch("/rest/v1/users?select=id,name,created_at&order=created_at.desc&limit=20");

  return NextResponse.json({ status: "ok", users: users || [], yourUserId: userId });
}

async function runMigrationViaManagementAPI(): Promise<{ ok: boolean; error?: string }> {
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!mgmtToken) return { ok: false, error: "SUPABASE_ACCESS_TOKEN not available" };

  const res = await fetch(`https://api.supabase.com/v1/projects/${SH_PROJECT}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SH_MIGRATION_SQL }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    return { ok: false, error: `Management API error (${res.status}): ${err}` };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.action !== "migrate") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const result = await runMigrationViaManagementAPI();
  if (!result.ok) {
    return NextResponse.json({ status: "error", message: result.error }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", message: "Migration completed successfully" });
}
