// Parent-digest email delivery. The monthly `send_parent_digests` RPC writes
// email-ready rows (status='pending') — this flush actually mails them via
// Resend (no SDK dependency: one fetch call), then marks each row sent/failed.
//
// No RESEND_API_KEY / RESEND_FROM_EMAIL → skipped (the bell notification the
// RPC already fired is the fallback). Best-effort — never throws. Transient
// failures (network, 5xx) leave the row pending so the next cron run retries;
// permanent rejections (4xx) mark it failed so it doesn't retry forever.

import { createAdminClient } from "@/lib/supabase/admin";

interface PendingDigest {
  id: string;
  parent_email: string;
  body: string;
}

export interface EmailFlushResult {
  emailed: number;
  failed: number;
  skipped: boolean;
}

export async function flushParentDigestEmails(
  fetchImpl: typeof fetch = fetch,
): Promise<EmailFlushResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { emailed: 0, failed: 0, skipped: true };

  const admin = createAdminClient();
  const { data } = await admin
    .from("parent_digests")
    .select("id, parent_email, body")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  let emailed = 0;
  let failed = 0;
  for (const digest of (data ?? []) as PendingDigest[]) {
    let permanent = false;
    try {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [digest.parent_email],
          subject: "Your child's LearningFans progress report",
          text: digest.body,
        }),
      });
      if (res.ok) {
        emailed += 1;
        await admin
          .from("parent_digests")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", digest.id);
        continue;
      }
      permanent = res.status >= 400 && res.status < 500;
    } catch {
      // Network/transport error — leave pending, retry on the next run.
    }
    failed += 1;
    if (permanent) {
      await admin.from("parent_digests").update({ status: "failed" }).eq("id", digest.id);
    }
  }

  return { emailed, failed, skipped: false };
}