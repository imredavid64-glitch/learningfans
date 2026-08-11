"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { NotificationRow } from "@/types/database";

export async function getNotifications(limit = 30): Promise<NotificationRow[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as NotificationRow[];
}

export async function getUnreadCount(): Promise<number> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (error || count === null) return 0;
  return count;
}

export async function markAllNotificationsRead(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  revalidatePath("/app/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", profile.id);

  revalidatePath("/app/notifications");
}
