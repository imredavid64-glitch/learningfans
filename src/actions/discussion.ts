"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isModerator } from "@/lib/auth";

export async function createThread(spaceSlug: string, formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlug)
    .single();

  if (!space) return;

  const { data, error } = await supabase
    .from("threads")
    .insert({
      space_id: space.id,
      author_id: profile.id,
      title,
      body,
    })
    .select("id")
    .single();

  if (error) return;

  redirect(`/app/spaces/${spaceSlug}/threads/${data.id}`);
}

export async function createPost(
  threadId: string,
  spaceSlug: string,
  formData: FormData,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const body = String(formData.get("body") ?? "").trim();

  const { error } = await supabase.from("posts").insert({
    thread_id: threadId,
    author_id: profile.id,
    body,
  });

  if (error) return;

  revalidatePath(`/app/spaces/${spaceSlug}/threads/${threadId}`);
}

export async function toggleThreadPin(
  threadId: string,
  spaceSlug: string,
  pinned: boolean,
): Promise<void> {
  const profile = await requireProfile();
  if (!isModerator(profile.role)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("threads")
    .update({ is_pinned: pinned })
    .eq("id", threadId);

  if (error) return;
  revalidatePath(`/app/spaces/${spaceSlug}`);
}

export async function toggleThreadLock(
  threadId: string,
  spaceSlug: string,
  locked: boolean,
): Promise<void> {
  const profile = await requireProfile();
  if (!isModerator(profile.role)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("threads")
    .update({ is_locked: locked })
    .eq("id", threadId);

  if (error) return;
  revalidatePath(`/app/spaces/${spaceSlug}`);
}

export async function hideThread(threadId: string, spaceSlug: string): Promise<void> {
  const profile = await requireProfile();
  if (!isModerator(profile.role)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("threads")
    .update({ is_hidden: true })
    .eq("id", threadId);

  if (error) return;

  await supabase.from("moderation_actions").insert({
    actor_id: profile.id,
    action: "hide_thread",
    target_type: "thread",
    target_id: threadId,
  });

  revalidatePath(spaceSlug ? `/app/spaces/${spaceSlug}` : "/app/mod");
}
