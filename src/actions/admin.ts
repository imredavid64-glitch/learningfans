"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateUserRoleFromForm(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  const supabase = await createClient();
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
    note: `Role set to ${role}`,
  });

  revalidatePath("/app/admin");
}
