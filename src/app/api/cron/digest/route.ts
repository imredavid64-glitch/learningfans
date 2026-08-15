import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartyReminders } from "@/lib/party-reminders";

export const runtime = "nodejs";

/** Vercel cron — weekly community digests. Mirrors /api/push/send auth. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Side-effect-free config check (?dry=1), mirroring /api/push/send: auth is
  // verified above; now probe the digest pipeline's surface with read-only head
  // queries + a read-only RPC. send_weekly_digests / send_parent_digests are the
  // side effects this mode exists to AVOID, so they're never called here.
  if (new URL(request.url).searchParams.get("dry") === "1") {
    const admin = createAdminClient();
    const [notifs, parents, stats, leaderboard] = await Promise.all([
      admin.from("notifications").select("id").limit(1),
      admin.from("parent_digests").select("id").limit(1),
      admin.from("user_stats").select("user_id").limit(1),
      admin.rpc("get_leaderboard", { p_limit: 1 }),
    ]);
    const db = {
      notifications: notifs.error ? "missing" : "ok",
      parent_digests: parents.error ? "missing" : "ok",
      user_stats: stats.error ? "missing" : "ok",
      get_leaderboard: leaderboard.error ? "missing" : "ok",
    };
    const ok = Object.values(db).every((v) => v === "ok");
    return NextResponse.json({ ok, mode: "dry", auth: "ok", db });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("send_weekly_digests");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Monthly parent digests ride the same Monday cron (the RPC self-gates to
  // once per student per rolling 30 days, so it's a cheap no-op on other weeks).
  let parentDigests = 0;
  try {
    const parent = await admin.rpc("send_parent_digests");
    if (!parent.error) parentDigests = (parent.data as number) ?? 0;
  } catch {
    // Non-fatal — the weekly digests already went out.
  }

  // Study-party reminders (safety net — the hub/room pages are the lazy path).
  const partyReminders = (await sendPartyReminders()).reminded;

  return NextResponse.json({ sent: data ?? 0, parentDigests, partyReminders });
}

export { GET as POST };
