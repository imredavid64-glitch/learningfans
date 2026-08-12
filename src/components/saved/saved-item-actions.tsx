"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveSavedItem, toggleSaveItem } from "@/actions/saved";
import type { SavedItemType } from "@/lib/saved";
import { Button } from "@/components/ui/button";
import { BookmarkX } from "lucide-react";

export function SavedItemActions({
  itemType,
  itemId,
  currentCollectionId,
  collections,
}: {
  itemType: SavedItemType;
  itemId: string;
  currentCollectionId: string | null;
  collections: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleMove(value: string) {
    const next = value || null;
    if (next === currentCollectionId) return;
    setBusy(true);
    const res = await moveSavedItem(itemType, itemId, next);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't move the item.");
      return;
    }
    router.refresh();
  }

  async function handleUnsave() {
    setBusy(true);
    const res = await toggleSaveItem(itemType, itemId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't remove the item.");
      return;
    }
    toast.success("Removed from saved.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentCollectionId ?? ""}
        disabled={busy}
        onChange={(e) => handleMove(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        aria-label="Move to folder"
      >
        <option value="">Uncategorized</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={handleUnsave}
        disabled={busy}
        aria-label="Remove from saved"
        title="Remove from saved"
      >
        <BookmarkX className="h-4 w-4" />
      </Button>
    </div>
  );
}
