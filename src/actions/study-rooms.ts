"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, checkRoomMessageFast } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import {
  ROOM_NAME_MAX_LENGTH,
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_MESSAGE_MAX_LENGTH,
  isValidWhiteboard,
  capStrokes,
  isAllowedReaction,
} from "@/lib/study-room-utils";

export type ActionResult = { redirect?: string; error?: string };

export interface StudyRoom {
  id: string;
  space_id: string | null;
  created_by: string;
  name: string;
  description: string | null;
  status: "active" | "ended";
  whiteboard: unknown;
  created_at: string;
  updated_at: string;
}

export async function createStudyRoom(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const spaceId = String(formData.get("spaceId") ?? "").trim() || null;

  if (!name) {
    return { error: "Room name is required." };
  }
  if (name.length > ROOM_NAME_MAX_LENGTH) {
    return { error: `Room name must be under ${ROOM_NAME_MAX_LENGTH} characters.` };
  }
  if (description.length > ROOM_DESCRIPTION_MAX_LENGTH) {
    return { error: `Description must be under ${ROOM_DESCRIPTION_MAX_LENGTH} characters.` };
  }

  if (spaceId) {
    const membership = await getSpaceMembership(spaceId, profile.id);
    if (!membership) {
      return { error: "You are not a member of that space." };
    }
  }

  const { data: room, error } = await supabase
    .from("study_rooms")
    .insert({
      space_id: spaceId,
      created_by: profile.id,
      name: name.slice(0, ROOM_NAME_MAX_LENGTH),
      description: description.slice(0, ROOM_DESCRIPTION_MAX_LENGTH) || null,
      status: "active",
      whiteboard: [],
    })
    .select("id")
    .single();

  if (error || !room) {
    if (isSchemaMissingError(error?.message)) {
      return { error: "Study rooms aren't set up yet on this database — apply the study_rooms migration first." };
    }
    return { error: error?.message ?? "Could not create the study room." };
  }

  revalidatePath("/app/study-rooms");
  return { redirect: `/app/study-rooms/${room.id}` };
}

/** Save a whiteboard snapshot. Strokes are capped both here and client-side. */
export async function saveWhiteboard(
  roomId: string,
  strokes: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("study_rooms")
    .select("status")
    .eq("id", roomId)
    .single();

  if (!room) return { ok: false, error: "Room not found." };
  if (room.status !== "active") return { ok: false, error: "This room has ended." };

  if (!isValidWhiteboard(strokes)) {
    return { ok: false, error: "Whiteboard snapshot is too large." };
  }

  const capped = capStrokes(strokes);

  const { error } = await supabase
    .from("study_rooms")
    .update({ whiteboard: capped, updated_at: new Date().toISOString() })
    .eq("id", roomId);

  if (error) return { ok: false, error: error.message };
  void profile;
  return { ok: true };
}

export async function clearWhiteboard(roomId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("study_rooms")
    .update({ whiteboard: [], updated_at: new Date().toISOString() })
    .eq("id", roomId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** End a room (creator or space/app moderator only — RLS enforces). */
export async function endStudyRoom(roomId: string): Promise<void> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("study_rooms")
    .update({ status: "ended", updated_at: new Date().toISOString() })
    .eq("id", roomId);

  if (error) {
    redirect(`/app/study-rooms/${roomId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/study-rooms/${roomId}`);
  revalidatePath("/app/study-rooms");
  redirect("/app/study-rooms");
}

function isSchemaMissingError(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("PGRST205") ||
    message.includes("PGRST301")
  );
}

export async function sendRoomMessage(
  roomId: string,
  body: string,
  mentionIds: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const text = String(body ?? "").trim();
  if (!text) return { ok: false, error: "Message can't be empty." };
  if (text.length > ROOM_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `Messages are limited to ${ROOM_MESSAGE_MAX_LENGTH} characters.` };
  }

  const { data: room } = await supabase
    .from("study_rooms")
    .select("id, status, name, space_id")
    .eq("id", roomId)
    .single();
  if (!room) return { ok: false, error: "Room not found." };
  if (room.status !== "active") return { ok: false, error: "This room has ended." };

  // Fast local checks only (profanity + spam) — no Groq round-trip on the
  // send path. Nuanced content is enqueued and AI-reviewed in batches.
  const moderation = await checkRoomMessageFast(profile.id, text, roomId);
  if (!moderation.isClean && moderation.riskLevel === "high") {
    return { ok: false, error: "This message was flagged by the moderation filter." };
  }

  const messageText = text.slice(0, ROOM_MESSAGE_MAX_LENGTH);
  const { data: inserted, error } = await supabase
    .from("study_room_messages")
    .insert({ room_id: roomId, user_id: profile.id, body: messageText })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Enqueue for batched AI review (best-effort — if the queue table doesn't
  // exist yet the message still sends and only local checks apply).
  const enqueued = await enqueueForModeration(roomId, profile.id, inserted.id, messageText);

  // Kick a non-blocking flush after the response is sent, so sending stays
  // instant even when the queue has a backlog.
  if (enqueued) {
    after(() => {
      void fetch(`${getAppUrl()}/api/moderation/chat`, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      }).catch(() => undefined);
    });
  }

  // Notify @mentioned users through the existing bell.
  await notifyMentions(room, text, mentionIds, profile);
  return { ok: true };
}

async function enqueueForModeration(
  roomId: string,
  userId: string,
  messageId: string,
  body: string,
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("chat_moderation_queue").insert({
      room_id: roomId,
      user_id: userId,
      message_id: messageId,
      content: body,
    });
    if (error) {
      console.error("Enqueue chat moderation failed:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function notifyMentions(
  room: { id: string; name: string; space_id: string | null },
  text: string,
  mentionIds: string[],
  actor: { id: string; display_name: string },
): Promise<void> {
  try {
    const supabase = await createClient();
    const ids = [...new Set(mentionIds.filter((id) => id && id !== actor.id))].slice(0, 10);
    if (ids.length === 0) return;

    const { data: targets } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    if (!targets?.length) return;

    // In a space-linked room only members (who can actually see it) are notified.
    let allowed = new Set(targets.map((t) => t.id));
    if (room.space_id) {
      const { data: members } = await supabase
        .from("space_members")
        .select("user_id")
        .eq("space_id", room.space_id);
      const memberIds = new Set((members ?? []).map((m) => m.user_id));
      allowed = new Set(targets.filter((t) => memberIds.has(t.id)).map((t) => t.id));
    }

    const preview = text.length > 120 ? `${text.slice(0, 120)}…` : text;
    for (const target of targets) {
      if (!allowed.has(target.id)) continue;
      await supabase.rpc("create_notification", {
        p_user_id: target.id,
        p_title: `${actor.display_name} mentioned you in ${room.name}`,
        p_body: preview,
        p_type: "mention",
        p_link: `/app/study-rooms/${room.id}`,
        p_actor_id: actor.id,
      });
    }
  } catch {
    // Mentions are best-effort — a failed notification never blocks the message.
  }
}

/** Add or remove an emoji reaction on a room message. */
export async function toggleReaction(
  roomId: string,
  messageId: string,
  emoji: string,
): Promise<{ ok: boolean; added?: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!isAllowedReaction(emoji)) return { ok: false, error: "Unknown reaction." };

  const { data: msg } = await supabase
    .from("study_room_messages")
    .select("id")
    .eq("id", messageId)
    .eq("room_id", roomId)
    .single();
  if (!msg) return { ok: false, error: "Message not found." };

  const { data: existing } = await supabase
    .from("study_room_message_reactions")
    .select("message_id")
    .eq("message_id", messageId)
    .eq("user_id", profile.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("study_room_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", profile.id)
      .eq("emoji", emoji);
    if (error) return { ok: false, error: error.message };
    return { ok: true, added: false };
  }

  const { error } = await supabase.from("study_room_message_reactions").insert({
    message_id: messageId,
    room_id: roomId,
    user_id: profile.id,
    emoji,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, added: true };
}
