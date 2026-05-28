"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FlashcardReview({
  cards,
}: {
  cards: { front: string; back: string }[];
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  if (!cards.length) {
    return <p className="text-sm text-muted-foreground">No cards in this set.</p>;
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>
          Card {index + 1} of {cards.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          className="flex min-h-[160px] w-full items-center justify-center rounded-lg border border-border bg-muted/30 p-6 text-center text-lg"
          onClick={() => setFlipped(!flipped)}
        >
          {flipped ? card.back : card.front}
        </button>
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => {
              setIndex((i) => i - 1);
              setFlipped(false);
            }}
          >
            Previous
          </Button>
          <Button
            disabled={index >= cards.length - 1}
            onClick={() => {
              setIndex((i) => i + 1);
              setFlipped(false);
            }}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
