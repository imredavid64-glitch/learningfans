"use client";

import { useState } from "react";
import { rsvpToParty, unrsvpParty } from "@/actions/party-rsvps";
import { Button } from "@/components/ui/button";
import { BellRing, Check, Loader2, Users } from "lucide-react";

interface PartyRsvpProps {
  roomId: string;
  initialAttending: boolean;
  initialCount: number;
}

/** RSVP / un-RSVP button for a scheduled study party, with attendee count. */
export function PartyRsvp({ roomId, initialAttending, initialCount }: PartyRsvpProps) {
  const [attending, setAttending] = useState(initialAttending);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const res = attending ? await unrsvpParty(roomId) : await rsvpToParty(roomId);
    setBusy(false);
    if (!res.ok) return;
    setAttending(!!res.attending);
    setCount(res.count ?? count);
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 tabular-nums text-muted-foreground"
        title="Going"
      >
        <Users className="h-3.5 w-3.5" />
        {count}
      </span>
      <Button
        size="sm"
        variant={attending ? "default" : "outline"}
        onClick={toggle}
        disabled={busy}
        className="gap-1.5"
        title={
          attending
            ? "You're going — you'll get a reminder before it starts. Click to cancel."
            : "RSVP to get a reminder before it starts"
        }
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : attending ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <BellRing className="h-3.5 w-3.5" />
        )}
        {attending ? "Going" : "RSVP"}
      </Button>
    </div>
  );
}
