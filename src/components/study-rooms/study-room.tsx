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
import { QuizBattle, type BattleQuizMeta } from "@/components/study-rooms/quiz-battle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import {
  Check,
  Copy,
  DoorOpen,
  ExternalLink,
  Link2,
  Maximize2,
  Minimize2,
  PhoneOff,
  Video,
  XCircle,
} from "lucide-react";

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
  battleQuizzes = [],
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
  battleQuizzes?: BattleQuizMeta[];
}) {
  const [copied, setCopied] = useState(false);
  const [callMode, setCallMode] = useState<"closed" | "open" | "minimized">("closed");
  const [callFullscreen, setCallFullscreen] = useState(false);
  const isCreator = room.created_by === userId;
  const ended = room.status !== "active";

  const rawCallUrl = studyRoomCallUrl(room.id, room.name);
  const embedCallUrl = `${rawCallUrl}#userInfo.displayName="${encodeURIComponent(displayName)}"&config.prejoinPageEnabled=false&config.disableDeepLinking=true`;

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
    void hapticLight();
    window.setTimeout(() => setCopied(false), 2000);
  }

  function handleToggleCall() {
    if (callMode === "closed") {
      setCallMode("open");
      void hapticMedium();
    } else {
      setCallMode("closed");
      void hapticLight();
    }
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
              <Button
                variant={callMode === "open" ? "default" : "outline"}
                size="sm"
                className={`h-8 gap-1.5 text-xs ${callMode !== "closed" ? "border-green-500/50 text-green-600 dark:text-green-400" : ""}`}
                onClick={handleToggleCall}
              >
                <Video className="h-3.5 w-3.5" />
                {callMode === "closed" ? "Join Video Call" : callMode === "minimized" ? "Expand Video Call" : "In Call"}
              </Button>
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
          Share the invite link so friends can join, talk, and draw together in real time.
        </p>
      </div>

      {/* In-Room Live Call Panel */}
      {callMode === "open" && !ended && (
        <div
          className={`space-y-2 rounded-xl border bg-card p-3 shadow-md transition-all ${
            callFullscreen ? "fixed inset-0 z-50 rounded-none bg-black p-4" : ""
          }`}
        >
          <div className="flex items-center justify-between border-b pb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold">Live Room Audio & Video</span>
              <span className="text-muted-foreground hidden sm:inline">· Connected as {displayName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setCallMode("minimized")}
                title="Minimize Call"
              >
                <Minimize2 className="h-3.5 w-3.5" /> Minimize
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCallFullscreen(!callFullscreen)}
                title={callFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <a href={rawCallUrl} target="_blank" rel="noopener noreferrer" title="Open in external window">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setCallMode("closed")}
              >
                <PhoneOff className="h-3.5 w-3.5" /> Leave Call
              </Button>
            </div>
          </div>

          <div
            className={`relative overflow-hidden rounded-lg bg-black ${
              callFullscreen ? "h-[calc(100vh-80px)] w-full" : "aspect-video max-h-[360px] w-full"
            }`}
          >
            <iframe
              src={embedCallUrl}
              allow="camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="h-full w-full border-0"
              title={`Study Room Call: ${room.name}`}
            />
          </div>
        </div>
      )}

      {/* Minimized Live Call Floating Banner */}
      {callMode === "minimized" && !ended && (
        <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-foreground backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span><strong>Live Call Active</strong> — you are connected to room audio & video</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setCallMode("open")}
            >
              <Maximize2 className="h-3 w-3" /> Expand Video
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => setCallMode("closed")}
            >
              <PhoneOff className="h-3 w-3" /> Leave Call
            </Button>
          </div>
        </div>
      )}

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
          <QuizBattle
            roomId={room.id}
            userId={userId}
            displayName={displayName}
            disabled={ended}
            availableQuizzes={battleQuizzes}
          />
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
