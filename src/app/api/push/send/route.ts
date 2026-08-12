import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPushPayload, getVapidConfig } from "@/lib/push";

export const runtime = "nodejs";

const BATCH_LIMIT = 100;

interface SubscriptionRow {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.PUSH_CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapid = getVapidConfig();
  if (!vapid) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: notifications } = await admin
    .from("notifications")
    .select("id, user_id, title, body, link")
    .is("push_sent_at", null)
    .is("read_at", null)
    .gte("created_at", dayAgo)
    .limit(BATCH_LIMIT);

  if (!notifications || notifications.length === 0) {
    return NextResponse.json({ sent: 0 });
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

  return NextResponse.json({ sent });
}

export { GET as POST };
