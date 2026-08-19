"use client";

import React, { useState, useEffect } from "react";
import { Mic, MicOff, PhoneOff, Radio, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function AudioHuddleRoom({
  roomName,
  displayName,
  onLeave,
}: {
  roomId: string;
  roomName: string;
  displayName: string;
  onLeave: () => void;
}) {
  const [muted, setMuted] = useState(true);

  // Simulate audio huddle connection status
  useEffect(() => {
    toast.success(`Connected to audio huddle: ${roomName}`);
    return () => {
      toast.info("Left audio huddle");
    };
  }, [roomName]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (next) {
        toast.info("Mic muted");
      } else {
        toast.success("Mic live — speaking in huddle");
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <h3 className="font-semibold text-sm">Audio Huddle ({roomName})</h3>
        </div>
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30 gap-1">
          <Radio className="h-3 w-3 animate-pulse" /> Live HD Audio
        </Badge>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-2">
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/55 border border-border text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
            {displayName.charAt(0).toUpperCase()}
            {!muted && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white">
                <Volume2 className="h-2.5 w-2.5 animate-pulse" />
              </span>
            )}
          </div>
          <span className="text-xs font-medium truncate w-full">You ({displayName})</span>
          <span className="text-[10px] text-muted-foreground">{muted ? "Muted" : "Speaking"}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 border-t border-border">
        <Button
          variant={muted ? "outline" : "default"}
          size="sm"
          className={muted ? "" : "bg-green-600 hover:bg-green-700 text-white"}
          onClick={toggleMute}
        >
          {muted ? <MicOff className="h-4 w-4 mr-1.5" /> : <Mic className="h-4 w-4 mr-1.5" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          onClick={onLeave}
        >
          <PhoneOff className="h-4 w-4" /> Leave Huddle
        </Button>
      </div>
    </div>
  );
}
