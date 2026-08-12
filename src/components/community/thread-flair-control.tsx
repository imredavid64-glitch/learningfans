"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setThreadFlair } from "@/actions/discussion";
import { FLAIR_COLOR_CLASSES, type CommunityFlair } from "@/lib/community";
import { cn } from "@/lib/utils";

export function ThreadFlairControl({
  threadId,
  currentFlairId,
  flairs,
  canEdit,
}: {
  threadId: string;
  currentFlairId: string | null;
  flairs: CommunityFlair[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current = flairs.find((f) => f.id === currentFlairId) ?? null;

  async function change(value: string) {
    const next = value || null;
    if (next === currentFlairId) return;
    setBusy(true);
    const res = await setThreadFlair(threadId, next);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't update the flair.");
      return;
    }
    router.refresh();
  }

  if (!canEdit || flairs.length === 0) {
    if (!current) return null;
    return (
      <span
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
          FLAIR_COLOR_CLASSES[
            (current.color ?? "blue") as keyof typeof FLAIR_COLOR_CLASSES
          ],
        )}
      >
        {current.label}
      </span>
    );
  }

  return (
    <select
      value={currentFlairId ?? ""}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
      aria-label="Thread flair"
    >
      <option value="">No flair</option>
      {flairs.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
