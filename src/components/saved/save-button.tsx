"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bookmark } from "lucide-react";
import { toggleSaveItem } from "@/actions/saved";
import type { SavedItemType } from "@/lib/saved";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveButton({
  itemType,
  itemId,
  initialSaved,
  compact,
}: {
  itemType: SavedItemType;
  itemId: string;
  initialSaved: boolean;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    const res = await toggleSaveItem(itemType, itemId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't update the bookmark.");
      return;
    }
    setSaved(Boolean(res.saved));
    toast.success(res.saved ? "Saved to your collection." : "Removed from saved.");
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", saved && "text-primary")}
        onClick={handle}
        disabled={busy}
        aria-label={saved ? "Remove from saved" : "Save"}
        title={saved ? "Remove from saved" : "Save"}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
      </Button>
    );
  }

  return (
    <Button
      variant={saved ? "secondary" : "ghost"}
      size="sm"
      className={cn("gap-1", saved && "text-primary")}
      onClick={handle}
      disabled={busy}
    >
      <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
