"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { FlashcardReview } from "@/components/materials/flashcard-review";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { loadOfflineDeck } from "@/lib/offline-decks";

export default function OfflineDeckPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;
  const deck = useMemo(() => (materialId ? loadOfflineDeck(materialId) : null), [materialId]);

  if (!deck) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
            This deck isn&apos;t saved on this device. Open it online and press “Save for offline”.
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <ButtonLink href="/app/offline" variant="outline">
            Back to offline decks
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/app/offline" className="text-sm text-muted-foreground hover:text-foreground">
            ← Offline decks
          </Link>
          <h1 className="text-xl font-bold mt-1">{deck.title}</h1>
          <p className="text-xs text-muted-foreground">Offline review · progress syncs when you&apos;re back online</p>
        </div>
      </div>

      <FlashcardReview
        cards={deck.cards}
        materialId={deck.materialId}
        creatorName="Offline"
        accentColor="blue"
      />
    </div>
  );
}
