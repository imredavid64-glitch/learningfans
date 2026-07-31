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

async function getSpaceSlug(supabase: Awaited<ReturnType<typeof createClient>>, spaceId: string): Promise<string> {
  const { data } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", spaceId)
    .single();
  return data?.slug || spaceId;
}

function threadPath(slug: string, threadId: string) {
  return `/app/classes/${slug}/threads/${threadId}`;
}

export async function createPost(threadId: string, formData: FormData): Promise<void> {
  if (checkBot(formData)) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  let body: string;
  try {
    ({ body } = validateOrThrow(postSchema, {
      body: String(formData.get("body") ?? "").trim(),
    }));
  } catch (err) {
    redirect(`/app/threads/${threadId}?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}`);
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id, is_locked")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect("/app/classes?error=Thread%20not%20found");
  }

  const slug = await getSpaceSlug(supabase, thread.space_id);

  if (thread.is_locked) {
    redirect(`${threadPath(slug, threadId)}?error=This%20thread%20is%20locked`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership) {
    redirect(`${threadPath(slug, threadId)}?error=You%20must%20be%20a%20member%20to%20reply`);
  }

  const moderation = await checkContentWithAI(body, "class discussion reply");

  if (!moderation.is_clean && moderation.risk_level === "high") {
    await supabase.from("user_sanctions").insert({
      user_id: profile.id,
      type: "suspend",
      reason: `AI moderation: ${moderation.violations.join(", ")}`,
    });
    redirect(`${threadPath(slug, threadId)}?error=Content%20violates%20community%20guidelines.%20Your%20account%20has%20been%20suspended.`);
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
    redirect(`${threadPath(slug, threadId)}?error=${encodeURIComponent(error.message)}`);
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
  revalidatePath(threadPath(slug, threadId));
  redirect(threadPath(slug, threadId));
}

export async function createThread(spaceId: string, formData: FormData): Promise<void> {
  if (checkBot(formData)) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  const slug = await getSpaceSlug(supabase, spaceId);

  let title: string;
  let body: string;
  try {
    ({ title, body } = validateOrThrow(threadSchema, {
      title: String(formData.get("title") ?? "").trim(),
      body: String(formData.get("body") ?? "").trim(),
    }));
  } catch (err) {
    redirect(`/app/classes/${slug}?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", spaceId)
    .eq("user_id", profile.id)
    .single();

  if (!membership) {
    redirect(`/app/classes/${slug}?error=You%20must%20be%20a%20member%20to%20create%20threads`);
  }

  const moderation = await checkContentWithAI(`${title}\n${body}`, "class discussion thread");

  if (!moderation.is_clean && moderation.risk_level === "high") {
    await supabase.from("user_sanctions").insert({
      user_id: profile.id,
      type: "suspend",
      reason: `AI moderation: ${moderation.violations.join(", ")}`,
    });
    redirect(`/app/classes/${slug}?error=Content%20violates%20community%20guidelines.%20Your%20account%20has%20been%20suspended.`);
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
    redirect(`/app/classes/${slug}?error=${encodeURIComponent(error.message)}`);
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
  revalidatePath(`/app/classes/${slug}`);
  redirect(threadPath(slug, thread.id));
}

async function getModActionSlug(supabase: Awaited<ReturnType<typeof createClient>>, threadId: string): Promise<string | null> {
  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();
  if (!thread) return null;
  return getSpaceSlug(supabase, thread.space_id);
}

export async function toggleThreadPin(threadId: string, pinned: boolean): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const slug = await getModActionSlug(supabase, threadId);
  if (!slug) {
    redirect("/app/classes?error=Thread%20not%20found");
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(threadPath(slug, threadId) + "?error=Thread%20not%20found");
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(threadPath(slug, threadId) + "?error=Unauthorized%20-%20moderator%20required");
  }

  const { error } = await supabase
    .from("threads")
    .update({ is_pinned: pinned })
    .eq("id", threadId);

  if (error) {
    redirect(threadPath(slug, threadId) + `?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(threadPath(slug, threadId));
}

export async function toggleThreadLock(threadId: string, locked: boolean): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const slug = await getModActionSlug(supabase, threadId);
  if (!slug) {
    redirect("/app/classes?error=Thread%20not%20found");
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(threadPath(slug, threadId) + "?error=Thread%20not%20found");
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(threadPath(slug, threadId) + "?error=Unauthorized%20-%20moderator%20required");
  }

  const { error } = await supabase
    .from("threads")
    .update({ is_locked: locked })
    .eq("id", threadId);

  if (error) {
    redirect(threadPath(slug, threadId) + `?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(threadPath(slug, threadId));
}

export async function hideThread(threadId: string, hidden: boolean): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const slug = await getModActionSlug(supabase, threadId);
  if (!slug) {
    redirect("/app/classes?error=Thread%20not%20found");
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id")
    .eq("id", threadId)
    .single();

  if (!thread) {
    redirect(threadPath(slug, threadId) + "?error=Thread%20not%20found");
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(threadPath(slug, threadId) + "?error=Unauthorized%20-%20moderator%20required");
  }

  const { error } = await supabase
    .from("threads")
    .update({ is_hidden: hidden })
    .eq("id", threadId);

  if (error) {
    redirect(threadPath(slug, threadId) + `?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(threadPath(slug, threadId));
}
