"use client";

import { useState } from "react";
import Link from "next/link";
import { endStudyRoom } from "@/actions/study-rooms";
import { studyRoomCallUrl, studyRoomInviteUrl } from "@/lib/study-room-utils";
import { RoomPresence } from "@/components/study-rooms/room-presence";
import { RoomModeration, type ModerationRow } from "@/components/study-rooms/room-moderation";
import { Whiteboard } from "@/components/study-rooms/whiteboard";
import { RoomChat, type RoomMessage } from "@/components/study-rooms/room-chat";
import { PomodoroTimer } from "@/components/study-rooms/pomodoro-timer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, DoorOpen, Link2, Video, XCircle } from "lucide-react";

export interface StudyRoomData {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "ended";
  space_id: string | null;
  created_by: string;
  whiteboard: unknown;
  starts_at: string | null;
  created_at: string;
  creator: { display_name: string } | null;
  spaces: { name: string; slug: string } | null;
}

export function StudyRoom({
  room,
  userId,
  displayName,
  initialMessages,
  mentionableUsers,
  initialReactions,
  isHost,
  moderationRows,
  myMuted,
  myBanned,
}: {
  room: StudyRoomData;
  userId: string;
  displayName: string;
  initialMessages: RoomMessage[];
  mentionableUsers: { id: string; display_name: string }[];
  initialReactions: { message_id: string; user_id: string; emoji: string }[];
  isHost: boolean;
  moderationRows: ModerationRow[];
  myMuted: boolean;
  myBanned: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isCreator = room.created_by === userId;
  const ended = room.status !== "active";

  async function copyInvite() {
    const url = studyRoomInviteUrl(room.id, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Room header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{room.name}</h1>
              {!ended ? (
                <Badge className="gap-1.5 bg-green-500/15 text-green-600 dark:text-green-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Live
                </Badge>
              ) : (
                <Badge variant="secondary">Ended</Badge>
              )}
              {room.spaces && (
                <Link href={`/app/spaces/${room.spaces.slug}`}>
                  <Badge variant="outline">📚 {room.spaces.name}</Badge>
                </Link>
              )}
            </div>
            {room.description && (
              <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Hosted by {room.creator?.display_name ?? "Unknown"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RoomPresence
              roomId={room.id}
              userId={userId}
              displayName={displayName}
              autoEndParty={Boolean(room.starts_at)}
            />
            <RoomModeration
              roomId={room.id}
              userId={userId}
              isHost={isHost}
              initialModeration={moderationRows}
            />
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={copyInvite}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy invite"}
            </Button>
            {!ended && (
              <a href={studyRoomCallUrl(room.id, room.name)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="h-8 gap-1.5 text-xs">
                  <Video className="h-3.5 w-3.5" /> Video call
                </Button>
              </a>
            )}
            {isCreator && !ended && (
              <form action={endStudyRoom.bind(null, room.id)}>
                <Button type="submit" variant="destructive" size="sm" className="h-8 gap-1.5 text-xs">
                  <XCircle className="h-3.5 w-3.5" /> End room
                </Button>
              </form>
            )}
            <Link href="/app/study-rooms">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <DoorOpen className="h-3.5 w-3.5" /> Leave
              </Button>
            </Link>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Share the invite link so friends can join and draw together in real time.
        </p>
      </div>

      {/* Board + tools */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[420px]">
          <Whiteboard
            roomId={room.id}
            userId={userId}
            displayName={displayName}
            initialStrokes={room.whiteboard}
            readOnly={ended}
            spaceSlug={room.spaces?.slug ?? null}
            roomName={room.name}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-6">
          <PomodoroTimer roomId={room.id} userId={userId} disabled={ended} />
          <div className="min-h-[380px] flex-1">
            <RoomChat
              key={room.id}
              roomId={room.id}
              userId={userId}
              initialMessages={initialMessages}
              mentionableUsers={mentionableUsers}
              initialReactions={initialReactions}
              disabled={ended}
              muted={myMuted}
              banned={myBanned}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
