import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPushPayload, getVapidConfig } from "@/lib/push";
import { drainChatModerationQueue } from "@/lib/chat-moderation";
import { sendPartyReminders } from "@/lib/party-reminders";
import { checkAndArchive } from "@/lib/supabase/server";
import { getDbUsageReport } from "@/lib/archive";

export const runtime = "nodejs";

const BATCH_LIMIT = 100;

interface SubscriptionRow {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function GET(request: Request) {
  // Vercel cron requests carry `Authorization: Bearer $CRON_SECRET` when the
  // CRON_SECRET env var is set (Vercel's built-in cron auth convention).
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapid = getVapidConfig();
  if (!vapid) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  // Side-effect-free config check (?dry=1): auth + VAPID env verified above;
  // now probe the tables the pipeline needs (read-only head queries). Exits
  // BEFORE any drain/archive/housekeeping/party-reminder/push side effects.
  if (new URL(request.url).searchParams.get("dry") === "1") {
    const admin = createAdminClient();
    // Read-only probes of the full push + bell/XP surface the pipeline needs:
    // the two push tables, the bell's user_stats table, and the leaderboard RPC
    // (read-only, p_limit=1 so it only fetches one row).
    const [subs, notifs, stats, leaderboard] = await Promise.all([
      admin.from("push_subscriptions").select("id").limit(1),
      admin.from("notifications").select("id").limit(1),
      admin.from("user_stats").select("user_id").limit(1),
      admin.rpc("get_leaderboard", { p_limit: 1 }),
    ]);
    const db = {
      push_subscriptions: subs.error ? "missing" : "ok",
      notifications: notifs.error ? "missing" : "ok",
      user_stats: stats.error ? "missing" : "ok",
      get_leaderboard: leaderboard.error ? "missing" : "ok",
    };
    const ok = Object.values(db).every((v) => v === "ok");
    return NextResponse.json({
      ok,
      mode: "dry",
      auth: "ok",
      vapid: { configured: true, subject: vapid.subject, publicKey: vapid.publicKey },
      db,
    });
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

  // Daily database housekeeping (free-tier 500 MB cap):
  // 1. Drain any chat messages still awaiting AI review (safety net — the
  //    queue is normally flushed right after each send).
  // 2. Archive old rows (moderation logs after 30d, chat history after 90d)
  //    to the archive project, then delete them from the main DB.
  // 3. Prune consumed moderation-queue rows, read notifications, and sent
  //    meeting reminders via the retention RPC.
  await drainChatModerationQueue({ maxChunks: 1 }).catch(() => undefined);
  await checkAndArchive().catch(() => undefined);
  try {
    await admin.rpc("run_housekeeping");
  } catch {
    // Non-fatal — housekeeping is best-effort; the cron continues.
  }

  // Study-party reminders (safety net — the hub/room pages are the lazy path).
  const partyReminders = (await sendPartyReminders()).reminded;

  // Auto-end scheduled study parties that never started (started 3+ hours
  // late with no one in the room). Best-effort — needs migration 0002.
  let staleEnded = 0;
  try {
    const { data } = await admin.rpc("end_stale_study_parties", { p_hours: 3 });
    staleEnded = typeof data === "number" ? data : 0;
  } catch {
    staleEnded = 0;
  }

  // Free-tier storage alert: when the DB passes 80% of the 500 MB cap, ping
  // the admins once per day through the existing bell (which then pushes).
  let storageNotified = false;
  try {
    const report = await getDbUsageReport();
    if (report.needsArchive && report.usagePercent > 0) {
      const { data: admins } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(20);
      const today = new Date().toISOString().slice(0, 10);
      for (const a of admins ?? []) {
        const { data: existing } = await admin
          .from("notifications")
          .select("id")
          .eq("user_id", a.id)
          .eq("type", "db_usage")
          .gte("created_at", `${today}T00:00:00.000Z`)
          .maybeSingle();
        if (existing) continue;
        await admin.rpc("create_notification", {
          p_user_id: a.id,
          p_title: "Database storage alert",
          p_body: `Your project is at ${Math.round(report.usagePercent * 100)}% of the 500 MB free-tier cap — archive or prune soon.`,
          p_type: "db_usage",
          p_link: "/app/admin",
        });
        storageNotified = true;
      }
    }
  } catch {
    storageNotified = false;
  }

  const { data: notifications } = await admin
    .from("notifications")
    .select("id, user_id, title, body, link")
    .is("push_sent_at", null)
    .is("read_at", null)
    .gte("created_at", dayAgo)
    .limit(BATCH_LIMIT);

  if (!notifications || notifications.length === 0) {
    return NextResponse.json({ sent: 0, partyReminders, staleEnded, storageNotified });
  }

  let sent = 0;
  for (const n of notifications) {
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("user_id", n.user_id);

    const rows = (subscriptions as SubscriptionRow[] | null) ?? [];
    if (rows.length === 0) continue;

    const payload = JSON.stringify(buildPushPayload(n));
    let delivered = false;
    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
        );
        delivered = true;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription is dead — remove it.
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    if (delivered) {
      sent += 1;
      await admin
        .from("notifications")
        .update({ push_sent_at: now })
        .eq("id", n.id);
    }
  }

  return NextResponse.json({ sent, partyReminders, staleEnded, storageNotified });
}

export { GET as POST };
