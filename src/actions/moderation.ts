"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isModerator, isAdmin } from "@/lib/auth";
import type { ReportStatus, SanctionType } from "@/lib/constants";

export async function createReport(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const { error } = await supabase.from("reports").insert({
    reporter_id: profile.id,
    target_type: targetType,
    target_id: targetId,
    reason,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<void> {
  const profile = await requireProfile();
  if (!isModerator(profile.role)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);

  if (error) return;
  revalidatePath("/app/mod");
}

export async function createSanction(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  if (!isModerator(profile.role)) return;

  const supabase = await createClient();
  const userId = String(formData.get("userId") ?? "");
  const type = String(formData.get("type") ?? "") as SanctionType;
  const reason = String(formData.get("reason") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "") || null;

  const { error } = await supabase.from("user_sanctions").insert({
    user_id: userId,
    type,
    reason,
    expires_at: expiresAt,
    created_by: profile.id,
  });

  if (error) return;

  await supabase.from("moderation_actions").insert({
    actor_id: profile.id,
    action: `sanction_${type}`,
    target_type: "profile",
    target_id: userId,
    note: reason,
  });

  revalidatePath("/app/mod");
}

export async function updateUserRole(userId: string, role: string) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) return { error: "Admin only" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { error: error.message };

  await supabase.from("moderation_actions").insert({
    actor_id: profile.id,
    action: "update_role",
    target_type: "profile",
    target_id: userId,
    note: `Role set to ${role}`,
  });

  revalidatePath("/app/admin");
  return { success: true };
}

export async function hideMaterial(materialId: string): Promise<void> {
  const profile = await requireProfile();
  if (!isModerator(profile.role)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("study_materials")
    .update({ is_hidden: true })
    .eq("id", materialId);

  if (error) return;

  await supabase.from("moderation_actions").insert({
    actor_id: profile.id,
    action: "hide_material",
    target_type: "material",
    target_id: materialId,
  });

  revalidatePath("/app/mod");
}
