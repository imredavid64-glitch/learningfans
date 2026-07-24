"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isAdmin, isModerator } from "@/lib/auth";
import { moderatePost } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { reportSchema, validateOrThrow } from "@/lib/validation";

export async function submitReport(
  targetType: "thread" | "post" | "material" | "profile",
  targetId: string,
  reason: string,
  description?: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireProfile();

  try {
    validateOrThrow(reportSchema, { reason });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid input" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("reports")
    .insert({
      reporter_id: profile.id,
      target_type: targetType,
      target_id: targetId,
      reason: reason.slice(0, 2000),
      description: description?.slice(0, 2000) || null,
      status: "open",
      created_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit("report_create", profile.id, { targetType, targetId, reason: reason.slice(0, 100) });

  revalidatePath("/app/moderation");
  return { success: true };
}

export async function submitReportFromForm(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const targetType = formData.get("targetType") as "thread" | "post" | "material" | "profile";
  const targetId = formData.get("targetId") as string;
  const reason = formData.get("reason") as string;
  const description = formData.get("description") as string | undefined;

  if (!targetType || !targetId || !reason) {
    return { success: false, error: "Missing required fields" };
  }

  const validTypes = ["thread", "post", "material", "profile"];
  if (!validTypes.includes(targetType)) {
    return { success: false, error: "Invalid target type" };
  }

  return submitReport(targetType, targetId, reason, description);
}

export async function moderateContent(
  targetType: "thread" | "post" | "material" | "profile",
  targetId: string,
  action: "approve" | "reject" | "hide" | "strike",
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireProfile();
  
  if (!isModerator(profile.role) && !isAdmin(profile.role)) {
    return { success: false, error: "Unauthorized - moderator required" };
  }

  const validActions = ["approve", "reject", "hide", "strike"];
  if (!validActions.includes(action)) {
    return { success: false, error: "Invalid action" };
  }

  const supabase = await createClient();
  
  let targetTable: string;
  let updateFields: Record<string, unknown> = {};
  
  switch (targetType) {
    case "thread":
      targetTable = "threads";
      break;
    case "post":
      targetTable = "posts";
      break;
    case "material":
      targetTable = "study_materials";
      break;
    case "profile":
      targetTable = "profiles";
      break;
    default:
      return { success: false, error: "Invalid target type" };
  }

  switch (action) {
    case "approve":
      updateFields = { is_hidden: false };
      if (targetType === "post") {
        await moderatePost(targetId);
      }
      break;
    case "hide":
      updateFields = { is_hidden: true };
      if (targetType === "profile") {
        await supabase.from("user_sanctions").insert({
          user_id: targetId,
          type: "suspend",
          reason: note?.slice(0, 500) || "Content moderation violation",
          created_by: profile.id,
        });
      }
      break;
    case "strike":
      await supabase.from("user_sanctions").insert({
        user_id: targetId,
        type: "warn",
        reason: note?.slice(0, 500) || "Content moderation violation - strike",
        created_by: profile.id,
      });
      break;
    case "reject":
      updateFields = { is_hidden: true };
      break;
  }

  if (Object.keys(updateFields).length > 0) {
    const { error } = await supabase
      .from(targetTable)
      .update(updateFields)
      .eq("id", targetId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  await supabase.from("moderation_actions").insert({
    actor_id: profile.id,
    action: action,
    target_type: targetType,
    target_id: targetId,
    note: note?.slice(0, 500) || null,
  });

  await logAudit("moderation_action", profile.id, { targetType, targetId, action, note: note?.slice(0, 100) });

  revalidatePath(`/app/moderation`);
  if (targetType === "profile") revalidatePath("/app");
  return { success: true };
}

export async function autoModeratePost(postId: string): Promise<{ status: "approved" | "flagged" | "rejected" }> {
  return await moderatePost(postId);
}
