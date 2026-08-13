"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { shouldRsvpRemindNow } from "@/lib/study-room-utils";

export interface RsvpState {
  ok: boolean;
  attending?: boolean;
  count?: number;
  error?: string;
}

/**
 * Send an immediate reminder to one RSVPer (used when RSVPing to a party that
 * is already inside the reminder horizon). Also marks `reminded_at` so the
 * sweep doesn't double-notify. Best-effort.
 */
async function remindUserNow(roomId: string, userId: string, title: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("create_notification", {
      p_user_id: userId,
      p_title: title,
      p_body: "You RSVPed to this study party — it starts very soon!",
      p_type: "party_reminder",
      p_link: `/app/study-rooms/${roomId}`,
    });
    await admin
      .from("study_room_rsvps")
      .update({ reminded_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  } catch {
    // Best-effort — the sweep will cover it later.
  }
}

export async function rsvpToParty(roomId: string): Promise<RsvpState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("study_rooms")
    .select("id, status, starts_at, name")
    .eq("id", roomId)
    .single();

  if (!room) return { ok: false, error: "Party not found." };
  if (room.status !== "active") return { ok: false, error: "This party has ended." };
  const startsAtMs = room.starts_at ? new Date(room.starts_at).getTime() : 0;
  if (!room.starts_at || startsAtMs <= Date.now()) {
    return { ok: false, error: "This party has already started — just join the room!" };
  }

  const { error } = await supabase
    .from("study_room_rsvps")
    .upsert(
      { room_id: roomId, user_id: profile.id },
      { onConflict: "room_id,user_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };

  // Party is close — remind this RSVPer right away instead of waiting for the sweep.
  if (shouldRsvpRemindNow(startsAtMs, Date.now())) {
    await remindUserNow(roomId, profile.id, `You're in — ${String(room.name).slice(0, 80)} starts soon`);
  }

  const { count } = await supabase
    .from("study_room_rsvps")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", roomId);
  return { ok: true, attending: true, count: count ?? 1 };
}

export async function unrsvpParty(roomId: string): Promise<RsvpState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("study_room_rsvps")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };

  const { count } = await supabase
    .from("study_room_rsvps")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", roomId);
  return { ok: true, attending: false, count: count ?? 0 };
}
