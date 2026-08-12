"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { eventSchema, validateOrThrow } from "@/lib/validation";

const DEFAULT_REMINDER_MINUTES = 30;

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function scheduleEventReminders(
  eventId: string,
  title: string,
  startsAt: string,
  minutesBefore: number,
  recipientIds: string[],
): Promise<void> {
  if (recipientIds.length === 0) return;
  try {
    const supabase = await createClient();
    const scheduledFor = new Date(new Date(startsAt).getTime() - minutesBefore * 60_000);
    const text = `Reminder: "${title}" starts ${formatEventTime(startsAt)}.`;
    const rows = recipientIds.map((userId) => ({
      event_id: eventId,
      recipient_id: userId,
      reminder_text: text,
      scheduled_for: scheduledFor.toISOString(),
    }));
    await supabase.from("schedule_event_reminders").insert(rows);
  } catch {
    // Reminder table may not exist yet (migration not applied) — event still works.
  }
}

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

  const reminderRaw = Number(formData.get("reminder") ?? "");
  const reminderMinutesBefore = Number.isFinite(reminderRaw) && reminderRaw > 0
    ? Math.min(Math.round(reminderRaw), 10080)
    : DEFAULT_REMINDER_MINUTES;

  const { data: inserted, error } = await supabase
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
      reminder_minutes_before: reminderMinutesBefore,
      ...(room !== null && room !== "" ? { room } : {}),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    redirect(`/app/schedule?error=${encodeURIComponent(error.message ?? "Could not create event")}`);
  }

  // Remind the owner, plus RSVP'd attendees for shared events.
  const recipients: string[] = [profile.id];
  if (validVisibility === "space" && spaceId) {
    const { data: attendees } = await supabase
      .from("event_attendees")
      .select("user_id")
      .eq("event_id", inserted.id)
      .in("status", ["going", "maybe"]);
    for (const a of attendees ?? []) {
      if (a.user_id !== profile.id) recipients.push(a.user_id);
    }
  }
  await scheduleEventReminders(inserted.id, title, startsAt, reminderMinutesBefore, recipients);

  if (space) {
    revalidatePath(`/app/classes/${space.slug}/schedule`);
  }
  revalidatePath("/app/schedule");
  redirect(`/app/schedule`);
}

export async function getDueEventReminders(): Promise<{
  id: string;
  text: string;
  eventTitle: string;
  eventId: string;
  scheduledFor: string;
}[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { data } = await supabase
    .from("schedule_event_reminders")
    .select("id, reminder_text, scheduled_for, event_id, schedule_events!inner(id, title)")
    .eq("recipient_id", profile.id)
    .lte("scheduled_for", now)
    .is("sent_at", null)
    .limit(10);

  if (!data) return [];

  return (data as { id: string; reminder_text: string; scheduled_for: string; event_id: string; schedule_events: { id: string; title: string }[] | null }[]).map((r) => {
    const e = Array.isArray(r.schedule_events) ? r.schedule_events[0] : r.schedule_events;
    return {
      id: r.id,
      text: r.reminder_text,
      eventTitle: e?.title || "Untitled event",
      eventId: e?.id || r.event_id,
      scheduledFor: r.scheduled_for,
    };
  });
}

export async function dismissEventReminder(reminderId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("schedule_event_reminders")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("recipient_id", profile.id);
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
    .select("space_id, owner_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    redirect(`/app/schedule?error=Event%20not%20found`);
  }

  if (event.space_id) {
    const { data: membership } = await supabase
      .from("space_members")
      .select("role")
      .eq("space_id", event.space_id)
      .eq("user_id", profile.id)
      .single();

    if (!membership) {
      redirect(`/app/schedule?error=Not%20a%20member%20of%20this%20space`);
    }
  } else if (event.owner_id !== profile.id) {
    redirect(`/app/schedule?error=Not%20authorized`);
  }

  const { data: space } = event.space_id
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
