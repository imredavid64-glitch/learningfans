"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateReminder, getReminderSchedule } from "@/lib/reminders";

export type ActionResult = { redirect?: string; error?: string };

export interface Meeting {
  id: string;
  space_id: string | null;
  organizer_id: string;
  title: string;
  description: string | null;
  call_url: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
  created_at: string;
}

export interface MeetingWithParticipants extends Meeting {
  participants: { user_id: string; rsvp_status: string; profiles: { display_name: string } | null }[];
  organizer: { display_name: string } | null;
  spaces: { name: string; slug: string } | null;
}

export async function createMeeting(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const callUrl = String(formData.get("callUrl") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const spaceId = String(formData.get("spaceId") ?? "").trim() || null;
  const participantIdsRaw = String(formData.get("participantIds") ?? "").trim();
  const isImmediate = formData.get("is_immediate") === "true";

  if (!title || !startsAt || !endsAt) {
    return { redirect: "/app/meetings/new?error=Title%2C%20start%2C%20and%20end%20are%20required" };
  }

  if (title.length > 200) {
    return { redirect: "/app/meetings/new?error=Title%20too%20long" };
  }

  if (callUrl && !callUrl.startsWith("http")) {
    return { redirect: "/app/meetings/new?error=Invalid%20call%20URL" };
  }

  if (spaceId) {
    const membership = await getSpaceMembership(spaceId, profile.id);
    if (!membership) {
      return { redirect: "/app/meetings/new?error=You%20are%20not%20a%20member%20of%20this%20space" };
    }
  }

  let participantIds = participantIdsRaw
    ? participantIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (participantIds.length > 0) {
    const { data: validUsers } = await supabase
      .from("profiles")
      .select("id")
      .in("id", participantIds);

    const validIds = new Set((validUsers || []).map((u) => u.id));
    participantIds = participantIds.filter((id) => validIds.has(id));
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      space_id: spaceId,
      organizer_id: profile.id,
      title: title.slice(0, 200),
      description: description.slice(0, 2000) || null,
      call_url: callUrl || `https://meet.jit.si/LearningFans-Meeting-${Date.now()}`,
      starts_at: startsAt,
      ends_at: endsAt,
      status: isImmediate ? "live" : "scheduled",
    })
    .select()
    .single();

  if (error) {
    return { redirect: `/app/meetings/new?error=${encodeURIComponent(error.message)}` };
  }

  if (participantIds.length > 0) {
    const participants = participantIds.map((userId) => ({
      meeting_id: meeting.id,
      user_id: userId,
      rsvp_status: "pending",
    }));
    await supabase.from("meeting_participants").insert(participants);
  }

  await scheduleReminders(meeting.id, title, description, callUrl, startsAt, profile.display_name, participantIds);
  await logAudit("class_create", profile.id, { meetingId: meeting.id, title });

  revalidatePath("/app/meetings");
  revalidatePath("/app/schedule");
  return { redirect: `/app/meetings/${meeting.id}` };
}

async function scheduleReminders(
  meetingId: string,
  title: string,
  description: string | null,
  callUrl: string | null,
  startsAt: string,
  organizerName: string,
  participantIds: string[],
): Promise<void> {
  try {
    const supabase = await createClient();
    const hoursList = getReminderSchedule(startsAt, 60);

    for (const hours of hoursList) {
      const reminder = await generateReminder(
        { title, description, startsAt, callUrl, organizerName, participantCount: participantIds.length },
        hours,
      );

      const rows = participantIds.map((userId) => ({
        meeting_id: meetingId,
        recipient_id: userId,
        reminder_text: reminder.text,
        scheduled_for: reminder.scheduledFor.toISOString(),
      }));

      if (rows.length > 0) {
        await supabase.from("meeting_reminders").insert(rows);
      }
    }
  } catch {}
}

export async function getUpcomingMeetings(): Promise<MeetingWithParticipants[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const now = new Date().toISOString();

  const { data: organized } = await supabase
    .from("meetings")
    .select("*, organizer:profiles!organizer_id(display_name), spaces(name, slug)")
    .eq("organizer_id", profile.id)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(20);

  const { data: invited } = await supabase
    .from("meeting_participants")
    .select("meeting_id")
    .eq("user_id", profile.id);

  const invitedIds = (invited || []).map((p) => p.meeting_id);
  let invitedMeetings: MeetingWithParticipants[] = [];

  if (invitedIds.length > 0) {
    const { data } = await supabase
      .from("meetings")
      .select("*, organizer:profiles!organizer_id(display_name), spaces(name, slug)")
      .in("id", invitedIds)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(20);
    invitedMeetings = data || [];
  }

  const all = [...(organized || []), ...invitedMeetings];
  const seen = new Set<string>();
  const unique = all.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const withParticipants = await Promise.all(
    unique.map(async (m) => {
      const { data: participants } = await supabase
        .from("meeting_participants")
        .select("user_id, rsvp_status, profiles(display_name)")
        .eq("meeting_id", m.id);
      return { ...m, participants: participants || [] };
    }),
  );

  return withParticipants;
}

export async function getMeetingById(meetingId: string): Promise<MeetingWithParticipants | null> {
  await requireProfile();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, organizer:profiles!organizer_id(display_name), spaces(name, slug)")
    .eq("id", meetingId)
    .single();

  if (!meeting) return null;

  const { data: participants } = await supabase
    .from("meeting_participants")
    .select("user_id, rsvp_status, profiles(display_name)")
    .eq("meeting_id", meetingId);

  return { ...meeting, participants: participants || [] };
}

export async function rsvpMeeting(
  meetingId: string,
  status: "going" | "maybe" | "declined"
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const validStatuses = ["going", "maybe", "declined"];
  if (!validStatuses.includes(status)) {
    redirect(`/app/meetings/${meetingId}?error=Invalid%20status`);
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("space_id, organizer_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    redirect("/app/meetings?error=Meeting%20not%20found");
  }

  if (meeting.space_id) {
    const membership = await getSpaceMembership(meeting.space_id, profile.id);
    if (!membership) {
      redirect(`/app/meetings/${meetingId}?error=Not%20a%20member%20of%20this%20space`);
    }
  } else {
    const { data: invited } = await supabase
      .from("meeting_participants")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (!invited && meeting.organizer_id !== profile.id) {
      redirect(`/app/meetings/${meetingId}?error=Not%20invited%20to%20this%20meeting`);
    }
  }

  const { error } = await supabase
    .from("meeting_participants")
    .upsert({
      meeting_id: meetingId,
      user_id: profile.id,
      rsvp_status: status,
    }, { onConflict: "meeting_id,user_id" });

  if (error) {
    redirect(`/app/meetings/${meetingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/app/meetings/${meetingId}`);
  revalidatePath("/app/meetings");
}

export async function updateMeetingStatus(
  meetingId: string,
  status: "scheduled" | "live" | "completed" | "cancelled"
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("organizer_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    redirect("/app/meetings?error=Meeting%20not%20found");
  }

  if (meeting.organizer_id !== profile.id) {
    redirect(`/app/meetings/${meetingId}?error=Only%20the%20organizer%20can%20update%20status`);
  }

  await supabase
    .from("meetings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", meetingId);

  revalidatePath(`/app/meetings/${meetingId}`);
  revalidatePath("/app/meetings");
}

export async function cancelMeeting(meetingId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("organizer_id")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    redirect("/app/meetings?error=Meeting%20not%20found");
  }

  if (meeting.organizer_id !== profile.id) {
    redirect("/app/meetings?error=Only%20the%20organizer%20can%20cancel");
  }

  await supabase
    .from("meetings")
    .update({ status: "cancelled" })
    .eq("id", meetingId);

  revalidatePath("/app/meetings");
  redirect("/app/meetings");
}

export async function getMeetingReminders(): Promise<{
  id: string;
  text: string;
  meetingTitle: string;
  meetingId: string;
  scheduledFor: string;
}[]> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const now = new Date().toISOString();

  const { data } = await supabase
    .from("meeting_reminders")
    .select("id, reminder_text, scheduled_for, meeting_id, meetings!inner(id, title)")
    .eq("recipient_id", profile.id)
    .lte("scheduled_for", now)
    .is("sent_at", null)
    .limit(10);

  if (!data) return [];

  return (data as { id: string; reminder_text: string; scheduled_for: string; meeting_id: string; meetings: { id: string; title: string }[] | null }[]).map((r) => {
    const m = Array.isArray(r.meetings) ? r.meetings[0] : r.meetings;
    return {
      id: r.id,
      text: r.reminder_text,
      meetingTitle: m?.title || "Untitled Meeting",
      meetingId: m?.id || r.meeting_id,
      scheduledFor: r.scheduled_for,
    };
  });
}

export async function dismissReminder(reminderId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("meeting_reminders")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("recipient_id", profile.id);
}
