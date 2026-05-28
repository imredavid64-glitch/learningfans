"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isModerator } from "@/lib/auth";
import type { EventVisibility } from "@/lib/constants";

export async function createScheduleEvent(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const allDay = formData.get("allDay") === "on";
  const visibility = String(formData.get("visibility") ?? "private") as EventVisibility;
  const spaceId = String(formData.get("spaceId") ?? "") || null;
  const linkedMaterialId = String(formData.get("linkedMaterialId") ?? "") || null;
  const reminder = formData.get("reminder")
    ? Number(formData.get("reminder"))
    : null;

  if (visibility === "space" && spaceId && !isModerator(profile.role)) {
    const { data: membership } = await supabase
      .from("space_members")
      .select("role")
      .eq("space_id", spaceId)
      .eq("user_id", profile.id)
      .single();

    if (membership?.role !== "moderator") {
      return;
    }
  }

  const { error } = await supabase.from("schedule_events").insert({
    title,
    description: description || null,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    owner_id: profile.id,
    space_id: visibility === "space" ? spaceId : null,
    visibility,
    linked_material_id: linkedMaterialId,
    reminder_minutes_before: reminder,
  });

  if (error) return;
  revalidatePath("/app/schedule");
}

export async function deleteScheduleEvent(eventId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", eventId)
    .eq("owner_id", profile.id);

  if (error) return;
  revalidatePath("/app/schedule");
}

export async function setEventAttendance(
  eventId: string,
  status: "going" | "maybe",
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("event_attendees").upsert({
    event_id: eventId,
    user_id: profile.id,
    status,
  });

  if (error) return;
  revalidatePath("/app/schedule");
}
