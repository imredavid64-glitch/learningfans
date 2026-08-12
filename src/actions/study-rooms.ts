"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, checkProfanityWithEscalation } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import {
  ROOM_NAME_MAX_LENGTH,
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_MESSAGE_MAX_LENGTH,
  isValidWhiteboard,
  capStrokes,
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

/** Post a chat message (profanity-checked, same pipeline as discussion). */
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
    .select("id, status")
    .eq("id", roomId)
    .single();
  if (!room) return { ok: false, error: "Room not found." };
  if (room.status !== "active") return { ok: false, error: "This room has ended." };

  // Same moderation pipeline as posts/threads/materials.
  const moderation = await checkProfanityWithEscalation(profile.id, text, "message", roomId);
  if (!moderation.isClean && moderation.riskLevel === "high") {
    return { ok: false, error: "This message was flagged by the moderation filter." };
  }

  const { error } = await supabase.from("study_room_messages").insert({
    room_id: roomId,
    user_id: profile.id,
    body: text.slice(0, ROOM_MESSAGE_MAX_LENGTH),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
