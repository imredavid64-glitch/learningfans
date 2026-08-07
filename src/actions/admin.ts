"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES = new Set(["member", "moderator", "admin"]);

export async function updateUserRoleFromForm(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId || !VALID_ROLES.has(role)) return;

  if (userId === profile.id && role !== "admin") {
    return;
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (!target) return;

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) return;

  await supabase.from("moderation_actions").insert({
    actor_id: profile.id,
    action: "update_role",
    target_type: "profile",
    target_id: userId,
    note: `Role changed from ${target.role} to ${role}`,
  });

  revalidatePath("/app/admin");
}
