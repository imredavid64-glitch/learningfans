import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { StudyRoom, type StudyRoomData } from "@/components/study-rooms/study-room";
import type { RoomMessage } from "@/components/study-rooms/room-chat";

export default async function StudyRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: room, error: roomError } = await supabase
    .from("study_rooms")
    .select("*, creator:profiles!created_by(display_name), spaces(name, slug)")
    .eq("id", id)
    .single();

  if (
    roomError &&
    (roomError.message?.includes("schema cache") ||
      roomError.message?.includes("does not exist") ||
      roomError.message?.includes("Could not find the table") ||
      roomError.message?.includes("PGRST205") ||
      roomError.message?.includes("PGRST301"))
  ) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl border bg-card p-6 text-center">
        <h1 className="text-xl font-bold">Study rooms aren&apos;t set up yet</h1>
        <p className="text-sm text-muted-foreground">
          Apply the <code className="rounded bg-muted px-1">study_rooms</code> migration in the Supabase
          SQL editor to enable live rooms, whiteboards and chat.
        </p>
      </div>
    );
  }

  if (!room) notFound();

  const { data: messages } = await supabase
    .from("study_room_messages")
    .select("*, profiles(display_name, avatar_url)")
    .eq("room_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  // People who can be @mentioned in this room: space members when linked to a
  // space, otherwise anyone in the app (small-community scale).
  let mentionableUsers: { id: string; display_name: string }[] = [];
  if (room.space_id) {
    const { data: mentionRows } = await supabase
      .from("space_members")
      .select("profiles(id, display_name)")
      .eq("space_id", room.space_id)
      .limit(200);
    mentionableUsers = (mentionRows ?? [])
      .map((r) => {
        const raw = (r as { profiles: { id: string; display_name: string } | { id: string; display_name: string }[] }).profiles;
        return (Array.isArray(raw) ? raw[0] : raw) ?? null;
      })
      .filter((u): u is { id: string; display_name: string } => Boolean(u));
  } else {
    const { data: mentionRows } = await supabase.from("profiles").select("id, display_name").limit(200);
    mentionableUsers = (mentionRows ?? []) as { id: string; display_name: string }[];
  }

  const { data: reactionRows } = await supabase
    .from("study_room_message_reactions")
    .select("message_id, user_id, emoji")
    .eq("room_id", id)
    .limit(500);

  const roomData: StudyRoomData = {
    id: room.id,
    name: room.name,
    description: room.description,
    status: room.status as "active" | "ended",
    space_id: room.space_id,
    created_by: room.created_by,
    whiteboard: room.whiteboard,
    created_at: room.created_at,
    creator: room.creator as StudyRoomData["creator"],
    spaces: room.spaces as StudyRoomData["spaces"],
  };

  const chatMessages: RoomMessage[] = (messages ?? []).map((m) => ({
    id: m.id,
    room_id: id,
    user_id: m.user_id,
    body: m.body,
    hidden: (m as { hidden?: boolean }).hidden ?? false,
    created_at: m.created_at,
    profiles: (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) ?? null,
  }));

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <StudyRoom
        room={roomData}
        userId={profile.id}
        displayName={profile.display_name}
        initialMessages={chatMessages}
        mentionableUsers={mentionableUsers}
        initialReactions={
          (reactionRows ?? []).map((r) => ({
            message_id: r.message_id,
            user_id: r.user_id,
            emoji: r.emoji,
          }))
        }
      />
    </div>
  );
}
