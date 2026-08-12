"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership, isModerator } from "@/lib/auth";
import type { CommunityFlair } from "@/lib/community";
import { checkContentWithAI, checkAndArchive } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { threadSchema, postSchema, validateOrThrow } from "@/lib/validation";
import type { VoteValue } from "@/lib/thread-ranking";

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

  await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: 3,
    p_reason: "post_reply",
  });

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

  // Optional post flair — must exist in this community's flair list.
  const { data: spaceRow } = await supabase
    .from("spaces")
    .select("flairs")
    .or(`id.eq.${spaceId},slug.eq.${spaceId}`)
    .single();
  const spaceFlairs = Array.isArray(spaceRow?.flairs)
    ? (spaceRow.flairs as CommunityFlair[])
    : [];
  const flairId = String(formData.get("flair") ?? "").trim() || null;
  if (flairId && !spaceFlairs.some((f) => f.id === flairId)) {
    redirect(
      `/app/classes/${slug}?error=${encodeURIComponent("That flair doesn't exist in this community.")}`,
    );
  }

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
      flair_id: flairId,
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

  await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: 5,
    p_reason: "create_thread",
  });

  await logAudit("thread_create", profile.id, { spaceId, threadId: thread.id, title });

  checkAndArchive();
  revalidatePath(`/app/classes/${slug}`);
  redirect(threadPath(slug, thread.id));
}

/** Set (or clear) a thread's flair — authors and moderators only. */
export async function setThreadFlair(
  threadId: string,
  flairId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("id, author_id, space_id")
    .eq("id", threadId)
    .single();
  if (!thread) return { ok: false, error: "Thread not found." };

  const membership = await getSpaceMembership(thread.space_id, profile.id);
  const canEdit =
    thread.author_id === profile.id ||
    membership?.role === "moderator" ||
    isModerator(profile.role);
  if (!canEdit) {
    return { ok: false, error: "Only the author or a moderator can set the flair." };
  }

  let next: string | null = null;
  if (flairId) {
    const { data: space } = await supabase
      .from("spaces")
      .select("flairs")
      .eq("id", thread.space_id)
      .single();
    const flairs = Array.isArray(space?.flairs) ? (space.flairs as CommunityFlair[]) : [];
    if (!flairs.some((f) => f.id === flairId)) {
      return { ok: false, error: "That flair doesn't exist in this community." };
    }
    next = flairId;
  }

  const { error } = await supabase
    .from("threads")
    .update({ flair_id: next })
    .eq("id", threadId);
  if (error) return { ok: false, error: error.message };

  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", thread.space_id)
    .single();
  if (space) {
    revalidatePath(`/app/spaces/${space.slug}`);
    revalidatePath(`/app/spaces/${space.slug}/threads/${threadId}`);
  }
  return { ok: true };
}

/** Upvote / downvote / unvote a thread (Reddit-style). */
export async function voteOnThread(
  threadId: string,
  vote: VoteValue,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("space_id, is_hidden")
    .eq("id", threadId)
    .single();
  if (!thread || thread.is_hidden) return { ok: false, error: "Thread not found." };

  // Readers of the space may vote (public spaces open to everyone, private to members).
  const { data: space } = await supabase
    .from("spaces")
    .select("is_public")
    .eq("id", thread.space_id)
    .single();
  const membership = await getSpaceMembership(thread.space_id, profile.id);
  if (!space || (!space.is_public && !membership)) {
    return { ok: false, error: "You can't vote in this community." };
  }

  if (vote === 0) {
    const { error } = await supabase
      .from("post_votes")
      .delete()
      .eq("post_id", threadId)
      .eq("user_id", profile.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("post_votes").upsert(
      {
        post_id: threadId,
        user_id: profile.id,
        vote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "post_id,user_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  const slug = await getSpaceSlug(supabase, thread.space_id);
  revalidatePath(`/app/spaces/${slug}`);
  revalidatePath(`/app/spaces/${slug}/threads/${threadId}`);
  return { ok: true };
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
