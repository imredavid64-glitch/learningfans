"use client";

import { useEffect, useState } from "react";
import { formatPartyCountdown } from "@/lib/study-room-utils";

/** Live ticking countdown to a scheduled party start. Shows "Live" once it passes. */
export function PartyCountdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState(() => new Date().getTime());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(startsAt).getTime();
  if (Number.isNaN(target) || target <= now) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
        Live
      </span>
    );
  }

  return <span className="tabular-nums">in {formatPartyCountdown(target, now)}</span>;
}
