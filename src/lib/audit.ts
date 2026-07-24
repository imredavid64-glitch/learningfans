import { createClient } from "@/lib/supabase/server"

export type AuditAction =
  | "signup"
  | "signin"
  | "signout"
  | "class_create"
  | "class_join"
  | "class_leave"
  | "thread_create"
  | "post_create"
  | "report_create"
  | "moderation_action"
  | "sanction_create"
  | "grade_submit"
  | "grade_change"
  | "content_edit"
  | "content_delete"

export async function logAudit(
  action: AuditAction,
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      ip_address: null,
      metadata: metadata || {},
    })
  } catch {
    console.error("Audit log insert failed (non-blocking)")
  }
}
