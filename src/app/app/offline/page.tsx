"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listOfflineDecks,
  offlineCacheBytes,
  OFFLINE_DECKS_UPDATE_EVENT,
  removeOfflineDeck,
  type OfflineDeck,
} from "@/lib/offline-decks";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function OfflinePage() {
  const [decks, setDecks] = useState<OfflineDeck[]>([]);
  const [bytes, setBytes] = useState(0);
  const offline = typeof navigator !== "undefined" ? !navigator.onLine : false;

  useEffect(() => {
    const refresh = () => {
      setDecks(listOfflineDecks());
      setBytes(offlineCacheBytes());
    };
    refresh();
    window.addEventListener(OFFLINE_DECKS_UPDATE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OFFLINE_DECKS_UPDATE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function remove(id: string) {
    removeOfflineDeck(id);
    toast.success("Deck removed");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offline decks</h1>
          <p className="text-muted-foreground">
            Flashcard decks saved on this device — review them without a connection.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <BookOpen className="h-3 w-3" />
          {decks.length} saved · {formatBytes(bytes)}
        </Badge>
      </div>

      {offline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <WifiOff className="h-4 w-4 text-amber-500" />
          You&apos;re offline — saved decks below are still available.
        </div>
      )}

      {decks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
            No decks saved yet. Open a flashcard set and press “Save for offline”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {decks.map((d) => (
            <Card key={d.materialId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <Link href={`/app/offline/${d.materialId}`} className="truncate hover:underline">
                    {d.title}
                  </Link>
                  <span className="text-xs font-normal text-muted-foreground">
                    {d.cards.length} cards
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 text-sm">
                <p className="text-muted-foreground">
                  Saved {new Date(d.savedAt).toLocaleDateString()} ·{" "}
                  {d.spaceSlug ? `from ${d.spaceSlug.replace(/-/g, " ")}` : "shared deck"}
                </p>
                <Button variant="ghost" size="sm" onClick={() => remove(d.materialId)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
