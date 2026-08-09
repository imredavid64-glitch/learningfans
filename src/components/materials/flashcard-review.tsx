"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function FlashcardReview({
  cards,
  isVip = false,
  creatorName = "Creator",
  accentColor = "indigo",
}: {
  cards: { front: string; back: string }[];
  isVip?: boolean;
  creatorName?: string;
  creatorAvatar?: string | null;
  accentColor?: string;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  if (!cards.length) {
    return (
      <Card className="mx-auto max-w-lg text-center py-12">
        <CardContent>
          <p className="text-muted-foreground mb-4">No cards in this set.</p>
          <Link href="/app/demo">
            <Button className="gap-2 w-full" onClick={() => toast.success("Loading sample flashcards...")}>
              <Sparkles className="h-4 w-4" />
              Load Sample Flashcards
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const accentClasses = {
    indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    green: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
    orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
    red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  };

  const accentClass = accentClasses[accentColor as keyof typeof accentClasses] || accentClasses.indigo;

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Card {index + 1} of {cards.length}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isVip && (
              <Badge variant="secondary" className="gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                <span className="text-xs">🔒</span> VIP
              </Badge>
            )}
            <Badge variant="outline" className={`gap-1.5 ${accentClass}`}>
              <Zap className="h-3 w-3" />
              Vector Cache
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className={`h-8 w-8 rounded-full bg-gradient-to-br from-${accentColor}-500 to-${accentColor}-600 flex items-center justify-center text-white font-medium text-sm`}>
            {creatorName.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-sm">{creatorName}</p>
            <p className="text-xs text-muted-foreground">Creator</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          className="flex min-h-[180px] w-full items-center justify-center rounded-lg border border-border bg-muted/30 p-6 text-center text-lg"
          onClick={() => setFlipped(!flipped)}
        >
          {flipped ? card.back : card.front}
        </button>
        
        {/* Self-Assessment Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/10 h-11"
            onClick={() => {
              // Review Again - re-queue card
              setFlipped(false);
            }}
          >
            <span className="text-lg">🔴</span> Review Again
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 h-11"
            onClick={() => {
              // Got It - standard interval
              setIndex((i) => (i + 1) % cards.length);
              setFlipped(false);
            }}
          >
            <span className="text-lg">🟡</span> Got It
          </Button>
          <Button
            variant="default"
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 h-11"
            onClick={() => {
              // Mastered - grants loyalty points
              setIndex((i) => (i + 1) % cards.length);
              setFlipped(false);
              // TODO: Award loyalty points
              toast.success("+10 XP earned!");
            }}
          >
            <span className="text-lg">🟢</span> Mastered (+10 XP)
          </Button>
        </div>
        
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            disabled={index === 0}
            className="h-11"
            onClick={() => {
              setIndex((i) => i - 1);
              setFlipped(false);
            }}
          >
            Previous
          </Button>
          <Button
            disabled={index >= cards.length - 1}
            className="h-11"
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
