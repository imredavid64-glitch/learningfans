"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { eventSchema, validateOrThrow } from "@/lib/validation";

export async function createEvent(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let title: string;
  let description: string;
  let startsAt: string;
  let endsAt: string;
  let allDay: boolean;

  try {
    ({ title, description, startsAt, endsAt, allDay } = validateOrThrow(eventSchema, {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
      allDay: formData.get("allDay") === "on",
    }));
  } catch (err) {
    redirect(`/app/schedule/new?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}`);
  }

  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const visibility = formData.get("visibility") as string;
  const validVisibility = visibility === "private" ? "private" : "space";

  // Private/personal events don't need a space. Shared events do.
  if (validVisibility === "space" && !spaceId) {
    redirect(`/app/schedule?error=Space%20is%20required%20for%20shared%20events`);
  }

  const room = String(formData.get("room") ?? "").trim().slice(0, 100);

  if (validVisibility === "space" && spaceId) {
    const { data: membership } = await supabase
      .from("space_members")
      .select("role")
      .eq("space_id", spaceId)
      .eq("user_id", profile.id)
      .single();

    if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
      redirect(`/app/schedule?error=Unauthorized%20-%20instructor%20only`);
    }
  }

  const { data: space } = spaceId
    ? await supabase.from("spaces").select("slug").eq("id", spaceId).single()
    : { data: null };

  const { error } = await supabase
    .from("schedule_events")
    .insert({
      space_id: spaceId || null,
      owner_id: profile.id,
      title: title.slice(0, 200),
      description: description.slice(0, 2000) || null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      timezone: "UTC",
      visibility: validVisibility,
      ...(room !== null && room !== "" ? { room } : {}),
    });

  if (error) {
    redirect(`/app/schedule?error=${encodeURIComponent(error.message)}`);
  }

  if (space) {
    revalidatePath(`/app/classes/${space.slug}/schedule`);
  }
  revalidatePath("/app/schedule");
  redirect(`/app/schedule`);
}

export async function rsvpToEvent(eventId: string, status: "going" | "maybe"): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!eventId || typeof eventId !== "string") {
    redirect(`/app/schedule?error=Invalid%20event`);
  }

  if (status !== "going" && status !== "maybe") {
    redirect(`/app/schedule?error=Invalid%20status`);
  }

  const { data: event } = await supabase
    .from("schedule_events")
    .select("space_id")
    .eq("id", eventId)
    .single();

  const { data: space } = event?.space_id
    ? await supabase.from("spaces").select("slug").eq("id", event.space_id).single()
    : { data: null };

  const { error } = await supabase
    .from("event_attendees")
    .upsert({
      event_id: eventId,
      user_id: profile.id,
      status,
    }, { onConflict: "event_id,user_id" });

  if (error) {
    redirect(`/app/schedule?error=${encodeURIComponent(error.message)}`);
  }

  if (space) {
    revalidatePath(`/app/classes/${space.slug}/schedule`);
  }
  revalidatePath("/app/schedule");
}

export async function deleteEvent(eventId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!eventId || typeof eventId !== "string") {
    redirect(`/app/schedule?error=Invalid%20event`);
  }

  const { data: event } = await supabase
    .from("schedule_events")
    .select("owner_id, space_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    redirect(`/app/schedule?error=Event%20not%20found`);
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", event.space_id)
    .eq("user_id", profile.id)
    .single();

  const isOwner = event.owner_id === profile.id;
  const isModerator = membership?.role === "moderator" || membership?.role === "admin";

  if (!isOwner && !isModerator) {
    redirect(`/app/schedule?error=Unauthorized`);
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", event.space_id)
    .single();

  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    redirect(`/app/schedule?error=${encodeURIComponent(error.message)}`);
  }

  if (space) {
    revalidatePath(`/app/classes/${space.slug}/schedule`);
  }
  revalidatePath("/app/schedule");
}
