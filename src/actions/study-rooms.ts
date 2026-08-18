"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import sharp from "sharp";
import { createClient, checkRoomMessageFast } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import {
  ROOM_NAME_MAX_LENGTH,
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_MESSAGE_MAX_LENGTH,
  ROOM_CHAT_RATE_MAX,
  ROOM_CHAT_RATE_WINDOW_SECONDS,
  ROOM_MUTE_SECONDS,
  POMODORO_FOCUS_SECONDS,
  isValidWhiteboard,
  capStrokes,
  isAllowedReaction,
} from "@/lib/study-room-utils";
import type { MaterialType } from "@/lib/constants";

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
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();

  if (!name) {
    return { error: "Room name is required." };
  }
  if (name.length > ROOM_NAME_MAX_LENGTH) {
    return { error: `Room name must be under ${ROOM_NAME_MAX_LENGTH} characters.` };
  }
  if (description.length > ROOM_DESCRIPTION_MAX_LENGTH) {
    return { error: `Description must be under ${ROOM_DESCRIPTION_MAX_LENGTH} characters.` };
  }

  // Optional scheduled start (study party). Only future times are accepted.
  let startsAt: string | null = null;
  if (startsAtRaw) {
    const parsed = new Date(startsAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "That start time isn't valid." };
    }
    if (parsed.getTime() <= Date.now()) {
      return { error: "Schedule a future start time, or leave it blank to start now." };
    }
    startsAt = parsed.toISOString();
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
      starts_at: startsAt,
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

  if (await isBanned(supabase, roomId, profile.id)) {
    return { ok: false, error: "You've been removed from this room." };
  }

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

/**
 * Record a completed focus block for the current user in a room. `focusKey`
 * dedupes the shared broadcast (every client fires the same completion with
 * the same key), so a 25-minute block counts once per participant. Used by the
 * "most minutes studied together" leaderboard. Best-effort — failures no-op.
 */
export async function recordStudySession(
  roomId: string,
  focusKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireProfile();
    const supabase = await createClient();
    const minutes = Math.round(POMODORO_FOCUS_SECONDS / 60);
    const { error } = await supabase.from("study_sessions").upsert(
      {
        room_id: roomId,
        user_id: profile.id,
        minutes,
        focus_key: focusKey.slice(0, 120),
      },
      { onConflict: "room_id,user_id,focus_key" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not record the study session." };
  }
}

/**
 * Pin the current whiteboard to a space as an image material, so the board
 * outlives the room. The client renders strokes to a PNG and sends it as a
 * data URL; we validate, downscale, store it in the `materials` bucket and
 * create a `file` material (which the feed shows with a thumbnail/lightbox).
 */
export async function pinWhiteboardToSpace(
  roomId: string,
  spaceSlug: string,
  dataUrl: string,
  title: string,
): Promise<{ ok: boolean; materialId?: string; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const spaceSlugClean = String(spaceSlug ?? "").trim();
  if (!spaceSlugClean) return { ok: false, error: "No community selected." };

  // Only pin from a room that actually belongs to this space.
  const { data: room } = await supabase
    .from("study_rooms")
    .select("space_id, name")
    .eq("id", roomId)
    .single();
  if (!room?.space_id) return { ok: false, error: "This room isn't linked to a community." };

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlugClean)
    .single();
  if (!space || space.id !== room.space_id) {
    return { ok: false, error: "Community mismatch." };
  }

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!membership) return { ok: false, error: "Join this community to pin the board." };

  // Parse the data URL. PNG only — canvas exports are always PNG.
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return { ok: false, error: "Invalid image data." };

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  } catch {
    return { ok: false, error: "Could not decode the board image." };
  }
  if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "Board image is too large." };
  }

  // Normalize: downscale huge boards and re-encode so storage stays lean.
  const normalized = await sharp(buffer)
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  buffer = Buffer.from(normalized);

  const boardTitle = String(title ?? "").trim().slice(0, 200) || `${room.name} — whiteboard`;

  const { data: material, error: matError } = await supabase
    .from("study_materials")
    .insert({
      space_id: space.id,
      author_id: profile.id,
      type: "file" as MaterialType,
      title: boardTitle,
      description: `Whiteboard from "${room.name}"`,
    })
    .select("id")
    .single();

  if (matError || !material) {
    return { ok: false, error: matError?.message ?? "Could not create the material." };
  }

  const path = `${profile.id}/${material.id}/whiteboard-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("materials")
    .upload(path, buffer, { contentType: "image/png", upsert: false });

  if (uploadError) {
    await supabase.from("study_materials").delete().eq("id", material.id);
    return { ok: false, error: uploadError.message };
  }

  await supabase.from("storage_objects").insert({
    user_id: profile.id,
    bucket: "materials",
    path,
    size_bytes: buffer.length,
    material_id: material.id,
  });

  await supabase
    .from("study_materials")
    .update({ storage_path: path, metadata: { mime: "image/png" } })
    .eq("id", material.id);

  revalidatePath(`/app/spaces/${spaceSlugClean}/materials`);
  return { ok: true, materialId: material.id };
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

/**
 * Auto-end a scheduled party once the last participant leaves. Fired by the
 * room's presence watcher on unmount when it detects it's the last connection
 * in the room. Idempotent and heavily guarded: the room must be an active
 * party that has already started, and the caller must have actually been part
 * of it (creator, RSVP, or a recorded study session) so a random user can't
 * kill a live party.
 */
export async function autoEndPartyWhenEmpty(
  roomId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data: room } = await admin
    .from("study_rooms")
    .select("status, starts_at, created_by")
    .eq("id", roomId)
    .single();
  if (!room) return { ok: false, error: "Room not found." };
  if (room.status !== "active") return { ok: false };
  if (!room.starts_at) return { ok: false, error: "Not a scheduled party." };
  if (new Date(room.starts_at).getTime() > Date.now()) {
    return { ok: false, error: "The party hasn't started yet." };
  }

  // Only someone who actually participated may trigger the auto-end.
  let involved = room.created_by === profile.id;
  if (!involved) {
    try {
      const { data: rsvp } = await admin
        .from("study_room_rsvps")
        .select("room_id")
        .eq("room_id", roomId)
        .eq("user_id", profile.id)
        .maybeSingle();
      involved = Boolean(rsvp);
    } catch {
      // Pre-migration — RSVPs table may not exist yet.
    }
  }
  if (!involved) {
    try {
      const { data: session } = await admin
        .from("study_sessions")
        .select("room_id")
        .eq("room_id", roomId)
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle();
      involved = Boolean(session);
    } catch {
      // Pre-migration — study_sessions table may not exist yet.
    }
  }
  if (!involved) return { ok: false, error: "You weren't part of this party." };

  const { error } = await admin
    .from("study_rooms")
    .update({ status: "ended", updated_at: new Date().toISOString() })
    .eq("id", roomId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/study-rooms/${roomId}`);
  revalidatePath("/app/study-rooms");
  return { ok: true };
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
  parentId?: string | null,
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

  // Threaded replies: the parent must exist and belong to this room. Depth is
  // capped client-side; here we only sanity-check the parent row.
  let resolvedParentId: string | null = null;
  if (parentId) {
    const { data: parent } = await supabase
      .from("study_room_messages")
      .select("id")
      .eq("id", parentId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (!parent) return { ok: false, error: "The message you're replying to no longer exists." };
    resolvedParentId = parentId;
  }

  // Host moderation — muted/banned participants can't post.
  const restriction = await getRoomRestriction(supabase, roomId, profile.id);
  if (restriction.banned) return { ok: false, error: "You've been removed from this room." };
  if (restriction.muted) return { ok: false, error: "You're muted in this room." };

  // Flood control — cap messages per rolling window (counted in the DB so it
  // holds across serverless instances, unlike the in-memory rate-limit.ts).
  const windowStart = new Date(Date.now() - ROOM_CHAT_RATE_WINDOW_SECONDS * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("study_room_messages")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("user_id", profile.id)
    .gte("created_at", windowStart);
  if (!countError && (count ?? 0) >= ROOM_CHAT_RATE_MAX) {
    return { ok: false, error: `You're sending messages too fast — please wait a few seconds.` };
  }

  // Fast local checks only (profanity + spam) — no Groq round-trip on the
  // send path. Nuanced content is enqueued and AI-reviewed in batches.
  const moderation = await checkRoomMessageFast(profile.id, text, roomId);
  if (!moderation.isClean && moderation.riskLevel === "high") {
    return { ok: false, error: "This message was flagged by the moderation filter." };
  }

  const messageText = text.slice(0, ROOM_MESSAGE_MAX_LENGTH);
  const { data: inserted, error } = await supabase
    .from("study_room_messages")
    .insert({ room_id: roomId, user_id: profile.id, body: messageText, parent_id: resolvedParentId })
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

interface RoomRestriction {
  muted: boolean;
  banned: boolean;
}

/** Current mute/ban state for a participant. Best-effort — returns clean on any error. */
async function getRoomRestriction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  userId: string,
): Promise<RoomRestriction> {
  try {
    const { data } = await supabase
      .from("study_room_moderation")
      .select("action, expires_at")
      .eq("room_id", roomId)
      .eq("user_id", userId);
    let muted = false;
    let banned = false;
    for (const row of data ?? []) {
      if (row.action === "ban") banned = true;
      else if (row.action === "mute" && row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
        muted = true;
      }
    }
    return { muted, banned };
  } catch {
    return { muted: false, banned: false };
  }
}

/** True when the caller is banned (blocked from chat + whiteboard) in a room. */
async function isBanned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  userId: string,
): Promise<boolean> {
  return (await getRoomRestriction(supabase, roomId, userId)).banned;
}

/** True when the caller is a host: room creator, app mod, or space mod. */
async function isRoomHost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  userId: string,
): Promise<boolean> {
  const { data: room } = await supabase
    .from("study_rooms")
    .select("created_by, space_id")
    .eq("id", roomId)
    .single();
  if (!room) return false;
  if (room.created_by === userId) return true;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profile?.role === "moderator" || profile?.role === "admin") return true;
  if (room.space_id) {
    const { data: membership } = await supabase
      .from("space_members")
      .select("role")
      .eq("space_id", room.space_id)
      .eq("user_id", userId)
      .maybeSingle();
    return membership?.role === "moderator";
  }
  return false;
}

/**
 * Mute, unmute, or ban a participant. Hosts (creator / app mod / space mod)
 * only, and hosts can't moderate themselves or other hosts.
 */
export async function moderateRoomMember(
  roomId: string,
  targetUserId: string,
  action: "mute" | "unmute" | "ban" | "unban",
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (targetUserId === profile.id) {
    return { ok: false, error: "You can't moderate yourself." };
  }
  if (!(await isRoomHost(supabase, roomId, profile.id))) {
    return { ok: false, error: "Only the room host can moderate participants." };
  }
  if (await isRoomHost(supabase, roomId, targetUserId)) {
    return { ok: false, error: "You can't moderate another host." };
  }

  const { data: room } = await supabase
    .from("study_rooms")
    .select("status")
    .eq("id", roomId)
    .single();
  if (!room) return { ok: false, error: "Room not found." };

  if (action === "unmute" || action === "unban") {
    const { error } = await supabase
      .from("study_room_moderation")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", targetUserId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const payload = {
    room_id: roomId,
    user_id: targetUserId,
    created_by: profile.id,
    action,
    expires_at:
      action === "mute"
        ? new Date(Date.now() + ROOM_MUTE_SECONDS * 1000).toISOString()
        : null,
  };
  const { error } = await supabase
    .from("study_room_moderation")
    .upsert(payload, { onConflict: "room_id,user_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
