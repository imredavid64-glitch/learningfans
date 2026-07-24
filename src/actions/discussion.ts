"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { checkContentWithAI, checkAndArchive } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { threadSchema, postSchema, validateOrThrow } from "@/lib/validation";

function checkBot(formData: FormData): boolean {
  const honeypot = formData.get("website") as string;
  const timestamp = formData.get("timestamp") as string;
  if (honeypot) return true;
  if (timestamp && Date.now() - Number(timestamp) < 2000) return true;
  return false;
}

export async function createPost(
  threadId: string,
  formData: FormData
): Promise<void> {
  if (checkBot(formData)) {
    redirect(`/app/classes/*/threads/${threadId}`);
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  let body: string;
  try {
    ({ body } = validateOrThrow(postSchema, {
      body: String(formData.get("body") ?? "").trim(),
    }));
  } catch (err) {
    redirect(`/app/classes/*/threads/${threadId}?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}`);
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id, is_locked")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(`/app/classes/*/threads/${threadId}?error=Thread%20not%20found`);
  }

  if (thread.is_locked) {
    redirect(`/app/classes/*/threads/${threadId}?error=This%20thread%20is%20locked`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership) {
    redirect(`/app/classes/*/threads/${threadId}?error=You%20must%20be%20a%20member%20to%20reply`);
  }

  const moderation = await checkContentWithAI(body, "class discussion reply");
  
  if (!moderation.is_clean && moderation.risk_level === "high") {
    await supabase.from("user_sanctions").insert({
      user_id: profile.id,
      type: "suspend",
      reason: `AI moderation: ${moderation.violations.join(", ")}`,
    });
    redirect(`/app/classes/*/threads/${threadId}?error=Content%20violates%20community%20guidelines.%20Your%20account%20has%20been%20suspended.`);
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      thread_id: threadId,
      author_id: profile.id,
      body,
      is_hidden: !moderation.is_clean,
    })
    .select()
    .single();

  if (error) {
    redirect(`/app/classes/*/threads/${threadId}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from("threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  if (!moderation.is_clean) {
    await supabase.from("moderation_actions").insert({
      actor_id: profile.id,
      action: "auto_flag",
      target_type: "post",
      target_id: post.id,
      note: `AI moderation flagged: ${moderation.violations.join(", ")}`,
    });
  }

  await logAudit("post_create", profile.id, { threadId, postId: post.id });

  checkAndArchive();

  revalidatePath(`/app/classes/*/threads/${threadId}`);
  redirect(`/app/classes/*/threads/${threadId}`);
}

export async function createThread(
  spaceId: string,
  formData: FormData
): Promise<void> {
  if (checkBot(formData)) {
    redirect(`/app/classes/${spaceId}`);
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  let title: string;
  let body: string;
  try {
    ({ title, body } = validateOrThrow(threadSchema, {
      title: String(formData.get("title") ?? "").trim(),
      body: String(formData.get("body") ?? "").trim(),
    }));
  } catch (err) {
    redirect(`/app/classes/${spaceId}?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", spaceId)
    .eq("user_id", profile.id)
    .single();

  if (!membership) {
    redirect(`/app/classes/${spaceId}?error=You%20must%20be%20a%20member%20to%20create%20threads`);
  }

  const moderation = await checkContentWithAI(`${title}\n${body}`, "class discussion thread");
  
  if (!moderation.is_clean && moderation.risk_level === "high") {
    await supabase.from("user_sanctions").insert({
      user_id: profile.id,
      type: "suspend",
      reason: `AI moderation: ${moderation.violations.join(", ")}`,
    });
    redirect(`/app/classes/${spaceId}?error=Content%20violates%20community%20guidelines.%20Your%20account%20has%20been%20suspended.`);
  }

  const { data: thread, error } = await supabase
    .from("threads")
    .insert({
      space_id: spaceId,
      author_id: profile.id,
      title,
      body,
      is_hidden: !moderation.is_clean,
    })
    .select()
    .single();

  if (error) {
    redirect(`/app/classes/${spaceId}?error=${encodeURIComponent(error.message)}`);
  }

  if (!moderation.is_clean) {
    await supabase.from("moderation_actions").insert({
      actor_id: profile.id,
      action: "auto_flag",
      target_type: "thread",
      target_id: thread.id,
      note: `AI moderation flagged: ${moderation.violations.join(", ")}`,
    });
  }

  await logAudit("thread_create", profile.id, { spaceId, threadId: thread.id, title });

  checkAndArchive();

  revalidatePath(`/app/classes/*`);
  redirect(`/app/classes/*/threads/${thread.id}`);
}

export async function toggleThreadPin(
  threadId: string,
  pinned: boolean
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(`/app/classes/*/threads/${threadId}?error=Thread%20not%20found`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(`/app/classes/*/threads/${threadId}?error=Unauthorized%20-%20moderator%20required`);
  }

  const { error } = await supabase
    .from("threads")
    .update({ is_pinned: pinned })
    .eq("id", threadId);

  if (error) {
    redirect(`/app/classes/*/threads/${threadId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/app/classes/*/threads/${threadId}`);
}

export async function toggleThreadLock(
  threadId: string,
  locked: boolean
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(`/app/classes/*/threads/${threadId}?error=Thread%20not%20found`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(`/app/classes/*/threads/${threadId}?error=Unauthorized%20-%20moderator%20required`);
  }

  const { error } = await supabase
    .from("threads")
    .update({ is_locked: locked })
    .eq("id", threadId);

  if (error) {
    redirect(`/app/classes/*/threads/${threadId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/app/classes/*/threads/${threadId}`);
}

export async function hideThread(
  threadId: string,
  hidden: boolean
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(`/app/classes/*/threads/${threadId}?error=Thread%20not%20found`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(`/app/classes/*/threads/${threadId}?error=Unauthorized%20-%20moderator%20required`);
  }

  const { error } = await supabase
    .from("threads")
    .update({ is_hidden: hidden })
    .eq("id", threadId);

  if (error) {
    redirect(`/app/classes/*/threads/${threadId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/app/classes/*/threads/${threadId}`);
}
