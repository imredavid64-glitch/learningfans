import { NextResponse } from "next/server";
import { drainChatModerationQueue } from "@/lib/chat-moderation";

export const runtime = "nodejs";

/**
 * Drains the chat moderation queue: claims pending messages in chunks and
 * sends each chunk to Groq in ONE batched request, hiding + logging anything
 * flagged. NOT a vercel.json cron (Hobby's two-cron limit is used by push +
 * digest) — it's triggered fire-and-forget after each chat send, and as a
 * safety net by the daily push cron.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await drainChatModerationQueue();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat moderation flush failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export { GET as POST };
