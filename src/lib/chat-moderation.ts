/**
 * Batched AI moderation for room chat.
 *
 * The send path only runs fast local checks and enqueues the message; a
 * background flush (triggered on send via `after()`, and as a safety net by
 * the daily push cron) claims pending rows in chunks and sends them to Groq
 * in ONE batched request. Flagged messages are hidden and logged, without
 * ever adding a Groq round-trip to the sender's latency.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const CHAT_MODERATION_BATCH_SIZE = 15;
export const CHAT_MODERATION_MAX_ATTEMPTS = 5;
export const CHAT_MODERATION_MAX_CHUNKS = 3;
export const CHAT_MODERATION_MAX_CONTENT_CHARS = 600;

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

export interface ChatModerationItem {
  id: string;
  message_id: string;
  room_id: string;
  user_id: string;
  content: string;
  attempts: number;
}

export interface ChatModerationVerdict {
  is_clean: boolean;
  risk_level: "none" | "low" | "medium" | "high";
  violations: string[];
  suggested_action?: string;
}

/**
 * Parse the batched Groq response. Pure and unit-testable: returns a map of
 * item id → verdict, or null when the response is unusable (caller retries).
 */
export function parseChatBatchResponse(
  raw: string,
  items: ChatModerationItem[],
): Map<string, ChatModerationVerdict> | null {
  let parsed: { results?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.results)) return null;

  const verdicts = new Map<string, ChatModerationVerdict>();
  for (const row of parsed.results) {
    if (!row || typeof row !== "object") continue;
    const index = (row as { index?: unknown }).index;
    const item =
      typeof index === "number" && items[index] ? items[index] : undefined;
    if (!item) continue;

    const risk = (row as { risk_level?: unknown }).risk_level;
    const violations = (row as { violations?: unknown }).violations;
    verdicts.set(item.id, {
      is_clean: (row as { is_clean?: unknown }).is_clean !== false,
      risk_level:
        risk === "none" || risk === "low" || risk === "medium" || risk === "high"
          ? risk
          : "none",
      violations: Array.isArray(violations)
        ? violations.filter((v): v is string => typeof v === "string").slice(0, 10)
        : [],
      suggested_action:
        typeof (row as { suggested_action?: unknown }).suggested_action === "string"
          ? (row as { suggested_action?: string }).suggested_action
          : undefined,
    });
  }
  return verdicts.size > 0 ? verdicts : null;
}

/** Flag messages that the AI rated medium/high risk or explicitly unclean. */
export function isFlagged(v: ChatModerationVerdict): boolean {
  return !v.is_clean && (v.risk_level === "high" || v.risk_level === "medium");
}

/**
 * Send one batched moderation request to Groq. Returns item id → verdict,
 * or null when the request/parse failed (rows stay pending for a retry).
 */
export async function moderateChatBatch(
  items: ChatModerationItem[],
): Promise<Map<string, ChatModerationVerdict> | null> {
  if (items.length === 0) return new Map();
  if (!GROQ_API_KEY) return null;

  const payload = items.map((item, index) => ({
    index,
    content: item.content.slice(0, CHAT_MODERATION_MAX_CONTENT_CHARS),
  }));

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a content moderation AI for an educational platform. Check a batch of chat messages for:
            1. Profanity/slurs
            2. Hate speech/discrimination
            3. Violence/threats
            4. Spam/repetitive patterns
            5. Inappropriate academic content
            6. Promotional / advertising / monetized content (selling products or services, affiliate links, self-promotion that adds no educational value)

            Content must be educational and on-topic for a learning community.
            Return JSON ONLY, in this exact shape:
            { "results": [ { "index": <int>, "is_clean": <bool>, "risk_level": "none"|"low"|"medium"|"high", "violations": [<string>], "suggested_action": "allow"|"warn"|"strike"|"ban" } ] }
            Include one result object for EVERY index.`,
          },
          {
            role: "user",
            content: `Messages to check:\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    return parseChatBatchResponse(text, items);
  } catch (error) {
    console.error("Groq batch moderation error:", error);
    return null;
  }
}

/**
 * Atomically claim up to `limit` pending rows. The claim is done inside a
 * SQL function (UPDATE ... RETURNING) so concurrent flushes never process
 * the same row twice, and attempts is bumped server-side.
 */
export async function claimChatModerationBatch(
  admin: SupabaseClient,
  limit: number,
): Promise<ChatModerationItem[]> {
  const { data, error } = await admin.rpc("claim_chat_moderation_batch", {
    p_limit: limit,
  });
  if (error) {
    console.error("Claim chat moderation batch failed:", error.message);
    return [];
  }
  return (data as ChatModerationItem[] | null) ?? [];
}

/**
 * Apply verdicts: mark processed; hide + log + escalate anything flagged.
 * Rows with no verdict are returned to pending (retried next flush).
 */
export async function applyChatModerationResults(
  admin: SupabaseClient,
  items: ChatModerationItem[],
  verdicts: Map<string, ChatModerationVerdict> | null,
): Promise<{ processed: number; flagged: number }> {
  let processed = 0;
  let flagged = 0;

  for (const item of items) {
    const verdict = verdicts?.get(item.id);

    if (!verdict) {
      // No verdict (API failure / bad parse) — retry later or give up.
      const done = item.attempts + 1 >= CHAT_MODERATION_MAX_ATTEMPTS;
      await admin
        .from("chat_moderation_queue")
        .update({ status: done ? "failed" : "pending" })
        .eq("id", item.id);
      continue;
    }

    processed += 1;

    if (isFlagged(verdict)) {
      flagged += 1;
      await admin
        .from("study_room_messages")
        .update({ hidden: true })
        .eq("id", item.message_id);

      // Log to the moderation log (space-scoped when the room is linked).
      const { data: room } = await admin
        .from("study_rooms")
        .select("space_id")
        .eq("id", item.room_id)
        .single();
      await admin.from("moderation_actions").insert({
        actor_id: item.user_id,
        action: "auto_flag",
        target_type: "message",
        target_id: item.message_id,
        space_id: room?.space_id ?? null,
        note: `AI moderation: ${verdict.violations.join(", ") || "flagged"}`,
      });

      // Escalate like the inline pipeline would (warning/restriction tiers).
      await admin.rpc("handle_profanity_escalation", {
        p_user_id: item.user_id,
        p_content: item.content.slice(0, CHAT_MODERATION_MAX_CONTENT_CHARS),
        p_detected_words: verdict.violations.length ? verdict.violations : ["ai-detected"],
        p_context_type: "message",
        p_context_id: item.message_id,
      });
    }

    await admin
      .from("chat_moderation_queue")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", item.id);
  }

  return { processed, flagged };
}

/**
 * Drain the queue in chunks. Returns totals. Called by the batch route
 * (triggered after each send) and as a safety net by the daily push cron.
 */
export async function drainChatModerationQueue(
  opts: { maxChunks?: number } = {},
): Promise<{ processed: number; flagged: number; remaining: number }> {
  const admin = createAdminClient();
  const maxChunks = opts.maxChunks ?? CHAT_MODERATION_MAX_CHUNKS;
  let processed = 0;
  let flagged = 0;

  for (let chunk = 0; chunk < maxChunks; chunk += 1) {
    const items = await claimChatModerationBatch(admin, CHAT_MODERATION_BATCH_SIZE);
    if (items.length === 0) break;

    const verdicts = await moderateChatBatch(items);
    const result = await applyChatModerationResults(admin, items, verdicts);
    processed += result.processed;
    flagged += result.flagged;
  }

  const { count } = await admin
    .from("chat_moderation_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return { processed, flagged, remaining: count ?? 0 };
}
