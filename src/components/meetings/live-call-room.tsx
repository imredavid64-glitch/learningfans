"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateMeetingStatus } from "@/actions/meetings";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import {
  Video,
  VideoOff,
  Maximize2,
  ExternalLink,
  PhoneOff,
  Play,
  CheckCircle,
  Users,
} from "lucide-react";

interface LiveCallRoomProps {
  meetingId: string;
  title: string;
  callUrl: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
  isOrganizer: boolean;
  userDisplayName: string;
}

export function LiveCallRoom({
  meetingId,
  title,
  callUrl,
  status,
  isOrganizer,
  userDisplayName,
}: LiveCallRoomProps) {
  const [inCall, setInCall] = useState(status === "live");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Construct iframe embed URL for Jitsi or default web call
  const isJitsi = callUrl.includes("meet.jit.si");
  const embedUrl = isJitsi
    ? `${callUrl}#userInfo.displayName="${encodeURIComponent(userDisplayName)}"`
    : callUrl;

  const handleStartCall = async () => {
    setInCall(true);
    void hapticMedium();
    if (isOrganizer && status === "scheduled") {
      await updateMeetingStatus(meetingId, "live");
    }
  };

  const handleEndCall = async () => {
    setInCall(false);
    void hapticLight();
    if (isOrganizer) {
      await updateMeetingStatus(meetingId, "completed");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">Live Call Room</h3>
            <p className="text-xs text-muted-foreground">In-app HD video, audio & screen share</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "live" && (
            <Badge className="animate-pulse bg-green-500/15 text-green-600 dark:text-green-400">
              ● Live Now
            </Badge>
          )}
          {status === "completed" && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3" /> Completed
            </Badge>
          )}
          <a
            href={callUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Open in new tab <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {!inCall ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 py-12 text-center">
          <div className="mb-3 rounded-full bg-primary/10 p-4 text-primary">
            <VideoOff className="h-8 w-8" />
          </div>
          <h4 className="text-lg font-medium text-foreground">Ready to join the meeting?</h4>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            {status === "completed"
              ? "This meeting has ended, but you can still reopen the call room if needed."
              : "Click below to enter the live video room with microphone & camera."}
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleStartCall} size="lg" className="gap-2">
              <Play className="h-4 w-4 fill-current" />
              {status === "live" ? "Join Call Room" : isOrganizer ? "Start Live Call" : "Enter Call Room"}
            </Button>
            <a href={callUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2">
                <ExternalLink className="h-4 w-4" /> External Window
              </Button>
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`relative overflow-hidden rounded-lg bg-black border shadow-inner transition-all ${
              isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "aspect-video w-full"
            }`}
          >
            <iframe
              src={embedUrl}
              allow="camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media; fullscreen"
              className="h-full w-full border-0"
              title={`Live call: ${title}`}
            />

            <div className="absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-black/60 p-1.5 backdrop-blur-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Connected as <strong className="text-foreground">{userDisplayName}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              {isOrganizer && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEndCall}
                  className="h-8 gap-1.5 text-xs"
                >
                  <PhoneOff className="h-3.5 w-3.5" /> End Meeting
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInCall(false)}
                className="h-8 text-xs"
              >
                Minimize Call
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
