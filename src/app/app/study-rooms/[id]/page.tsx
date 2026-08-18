import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { StudyRoom, type StudyRoomData } from "@/components/study-rooms/study-room";
import { PartyCountdown } from "@/components/study-rooms/party-countdown";
import { PartyRsvp } from "@/components/study-rooms/party-rsvp";
import { sendPartyReminders } from "@/lib/party-reminders";
import type { RoomMessage } from "@/components/study-rooms/room-chat";
import type { BattleQuizMeta } from "@/components/study-rooms/quiz-battle";

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

  // Host = room creator, app moderator, or space moderator (when space-linked).
  let isHost = room.created_by === profile.id || profile.role === "moderator" || profile.role === "admin";
  if (!isHost && room.space_id) {
    const { data: membership } = await supabase
      .from("space_members")
      .select("role")
      .eq("space_id", room.space_id)
      .eq("user_id", profile.id)
      .maybeSingle();
    isHost = membership?.role === "moderator";
  }

  // Moderation rows (mute/ban) — guarded so the page renders before the
  // room_moderation migration is applied.
  let moderationRows: { user_id: string; action: "mute" | "ban"; expires_at: string | null }[] = [];
  try {
    const { data: modRows } = await supabase
      .from("study_room_moderation")
      .select("user_id, action, expires_at")
      .eq("room_id", id);
    moderationRows = (modRows ?? []) as typeof moderationRows;
  } catch {
    moderationRows = [];
  }

  // The viewer's own restriction (muted/banned) drives the disabled composer.
  const myMod = moderationRows.find((m) => m.user_id === profile.id);
  const nowMs = new Date().getTime();
  const myMuted =
    myMod?.action === "mute" && (!myMod.expires_at || new Date(myMod.expires_at).getTime() > nowMs);
  const myBanned = myMod?.action === "ban";

  const roomData: StudyRoomData = {
    id: room.id,
    name: room.name,
    description: room.description,
    status: room.status as "active" | "ended",
    space_id: room.space_id,
    created_by: room.created_by,
    whiteboard: room.whiteboard,
    starts_at: (room as { starts_at?: string | null }).starts_at ?? null,
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
    parent_id: (m as { parent_id?: string | null }).parent_id ?? null,
    created_at: m.created_at,
    profiles: (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) ?? null,
  }));

  // Quizzes a battle may use: only ones whose content the room's viewers can
  // already see — quizzes in the room's own space, or in public communities.
  let battleQuizzes: BattleQuizMeta[] = [];
  try {
    const quizQuery = supabase
      .from("study_materials")
      .select("id, title, space_id, spaces(is_public)")
      .eq("type", "quiz")
      .eq("is_hidden", false)
      .limit(100);
    const { data: quizRows } = await quizQuery;
    battleQuizzes = ((quizRows ?? []) as {
      id: string;
      title: string;
      space_id: string | null;
      spaces: { is_public: boolean } | { is_public: boolean }[] | null;
    }[])
      .filter((q) => {
        const space = Array.isArray(q.spaces) ? q.spaces[0] : q.spaces;
        return Boolean(space?.is_public) || (Boolean(room.space_id) && q.space_id === room.space_id);
      })
      .map((q) => ({ id: q.id, title: q.title }))
      .slice(0, 20);
  } catch {
    battleQuizzes = [];
  }

  // Scheduled party banner: RSVP + countdown, plus the lazy reminder sweep.
  const partyStartsAtMs = room.starts_at ? new Date(room.starts_at).getTime() : 0;
  const isUpcomingParty = partyStartsAtMs > 0 && partyStartsAtMs > new Date().getTime();
  let myRsvp = false;
  let rsvpCount = 0;
  if (isUpcomingParty) {
    await sendPartyReminders();
    try {
      const { data: mine } = await supabase
        .from("study_room_rsvps")
        .select("room_id")
        .eq("room_id", id)
        .eq("user_id", profile.id)
        .maybeSingle();
      myRsvp = Boolean(mine);
      const { count } = await supabase
        .from("study_room_rsvps")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", id);
      rsvpCount = count ?? 0;
    } catch {
      // Pre-migration — banner renders without RSVP state.
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {isUpcomingParty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              🎉 Study party — starts{" "}
              <span className="tabular-nums">
                <PartyCountdown startsAt={room.starts_at!} />
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              RSVP to get a reminder before it starts.
            </p>
          </div>
          <PartyRsvp roomId={room.id} initialAttending={myRsvp} initialCount={rsvpCount} />
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
        isHost={isHost}
        moderationRows={moderationRows}
        myMuted={myMuted}
        myBanned={myBanned}
        battleQuizzes={battleQuizzes}
      />
    </div>
  );
}
