"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createSpace(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isPublic = formData.get("isPublic") === "on";
  const slug = slugify(String(formData.get("slug") ?? name));

  if (!name) return;

  const { data: space, error } = await supabase
    .from("spaces")
    .insert({
      name,
      description: description || null,
      slug,
      is_public: isPublic,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return;

  await supabase.from("space_members").insert({
    space_id: space.id,
    user_id: profile.id,
    role: "moderator",
  });

  const { redirect } = await import("next/navigation");
  redirect(`/app/spaces/${space.slug}`);
}

export async function joinSpace(spaceId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("space_members").insert({
    space_id: spaceId,
    user_id: profile.id,
    role: "member",
  });

  if (error) return;
  revalidatePath("/app/spaces");
}

export async function leaveSpace(spaceId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", profile.id);

  if (error) return;
  revalidatePath("/app/spaces");
}
