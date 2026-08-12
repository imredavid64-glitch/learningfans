"use client";

import { useState } from "react";
import { Download, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hapticLight } from "@/lib/haptics";
import {
  isDeckSavedOffline,
  removeOfflineDeck,
  saveDeckOffline,
} from "@/lib/offline-decks";

interface OfflineDeckButtonProps {
  materialId: string;
  title: string;
  spaceSlug: string;
  cards: { front: string; back: string }[];
}

export function OfflineDeckButton({ materialId, title, spaceSlug, cards }: OfflineDeckButtonProps) {
  const [saved, setSaved] = useState(() => isDeckSavedOffline(materialId));
  const offline = typeof navigator !== "undefined" ? !navigator.onLine : false;

  function toggle() {
    if (saved) {
      removeOfflineDeck(materialId);
      setSaved(false);
      toast.success("Deck removed from offline cache");
    } else {
      saveDeckOffline({
        materialId,
        title,
        spaceSlug,
        cards,
        savedAt: new Date().toISOString(),
      });
      setSaved(true);
      void hapticLight();
      toast.success(`"${title}" saved for offline review`);
    }
  }

  return (
    <Button
      variant={saved ? "outline" : "secondary"}
      size="sm"
      className="gap-1.5"
      onClick={toggle}
      title={
        saved
          ? "Remove this deck from your offline cache"
          : "Save this deck so you can review it without a connection"
      }
    >
      {saved ? <Trash2 className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {saved ? "Saved offline" : "Save for offline"}
      {offline && !saved && <WifiOff className="h-3.5 w-3.5" />}
    </Button>
  );
}
