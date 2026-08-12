"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { awardXp } from "@/actions/gamification";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  loadFlashcardProgress,
  reviewFlashcardLocally,
  type StoredCard,
} from "@/lib/flashcard-storage";
import type { ReviewGrade } from "@/lib/srs";

type ReviewOutcome = "again" | "good" | "easy";

interface Flashcard {
  front: string;
  back: string;
}

function buildQueue(cards: Flashcard[], progress: Record<number, StoredCard>): number[] {
  const now = Date.now();
  const due: number[] = [];
  const fresh: number[] = [];
  cards.forEach((_, i) => {
    const p = progress[i];
    if (!p) {
      fresh.push(i);
    } else if (p.status !== "mastered" && new Date(p.dueAt).getTime() <= now) {
      due.push(i);
    }
  });
  due.sort((a, b) => new Date(progress[a].dueAt).getTime() - new Date(progress[b].dueAt).getTime());
  return [...due, ...fresh];
}

export function FlashcardReview({
  cards,
  isVip = false,
  creatorName = "Creator",
  accentColor = "indigo",
  materialId,
}: {
  cards: Flashcard[];
  isVip?: boolean;
  creatorName?: string;
  creatorAvatar?: string | null;
  accentColor?: string;
  materialId?: string;
}) {
  // Progress is stored locally (localStorage) — only account data hits the DB.
  const [session, setSession] = useState<{ progress: Record<number, StoredCard>; queue: number[] }>(() => {
    const progress = materialId ? loadFlashcardProgress(materialId) : {};
    const base = materialId ? buildQueue(cards, progress) : cards.map((_, i) => i);
    return { progress, queue: base.length > 0 ? base : cards.map((_, i) => i) };
  });
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const { progress, queue } = session;
  const card = cards[queue[0]];
  const dueNow = queue.length;
  const masteredCount = Object.values(progress).filter((p) => p.status === "mastered").length;

  if (!cards.length) {
    return (
      <Card className="mx-auto max-w-lg text-center py-12">
        <CardContent>
          <p className="text-muted-foreground mb-4">No cards in this set.</p>
          <Link href="/demo">
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

  async function review(grade: ReviewGrade, outcome: ReviewOutcome) {
    const cardIndex = queue[0];
    if (grade === "again" || grade === "good") {
      void hapticLight();
    } else {
      void hapticSuccess();
    }
    if (materialId) {
      const next = reviewFlashcardLocally(materialId, cardIndex, grade);
      setSession((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          [cardIndex]: {
            easeFactor: next.easeFactor,
            intervalDays: next.intervalDays,
            repetitions: next.repetitions,
            status: next.status,
            dueAt: next.dueAt,
            lastReviewedAt: new Date().toISOString(),
          },
        },
      }));

      if (outcome === "easy") {
        const xpRes = await awardXp(10, "flashcard_mastered");
        if (xpRes.error) {
          toast.error(xpRes.error);
        } else if (xpRes.data) {
          const bonus = xpRes.data.bonus_xp ?? 0;
          toast.success(
            bonus > 0
              ? `+${10 + bonus} XP earned (+${bonus} streak bonus)! Level ${xpRes.data.level}`
              : `+10 XP earned! Level ${xpRes.data.level}`,
          );
        }
      }
    } else if (outcome === "easy") {
      toast.success("+10 XP earned!");
    }

    setFlipped(false);
    setReviewedCount((c) => c + 1);
    const nextQueue = grade === "again" ? [...queue.slice(1), cardIndex] : queue.slice(1);
    setSession((prev) => ({ ...prev, queue: nextQueue }));
    if (nextQueue.length === 0) {
      setSessionDone(true);
    }
  }

  if (sessionDone && queue.length === 0) {
    const allReviewed = Object.keys(progress).length >= cards.length;
    return (
      <Card className="mx-auto max-w-lg text-center py-12">
        <CardContent className="space-y-4">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <h3 className="text-lg font-semibold">Session complete!</h3>
          <p className="text-sm text-muted-foreground">
            You reviewed {reviewedCount} card{reviewedCount === 1 ? "" : "s"} this session.
            {masteredCount > 0 && ` ${masteredCount} card${masteredCount === 1 ? " is" : "s are"} mastered.`}
          </p>
          {!allReviewed && (
            <Button
              variant="outline"
              onClick={() => {
                setSessionDone(false);
                setSession((prev) => ({ ...prev, queue: cards.map((_, i) => i) }));
                setReviewedCount(0);
              }}
            >
              Review all cards
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {queue.length > 0 ? `Card ${cards.length - queue.length + 1} of ${cards.length}` : "Session"}
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
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full bg-gradient-to-br from-${accentColor}-500 to-${accentColor}-600 flex items-center justify-center text-white font-medium text-sm`}>
              {creatorName.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-sm">{creatorName}</p>
              <p className="text-xs text-muted-foreground">Creator</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              {dueNow} due now · {masteredCount} mastered
            </p>
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
            onClick={() => void review("again", "again")}
          >
            <span className="text-lg">🔴</span> Review Again
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 h-11"
            onClick={() => void review("good", "good")}
          >
            <span className="text-lg">🟡</span> Got It
          </Button>
          <Button
            variant="default"
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 h-11"
            onClick={() => void review("easy", "easy")}
          >
            <span className="text-lg">🟢</span> Mastered (+10 XP)
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Tap the card to flip it, then grade your recall — spaced repetition schedules the next review for you.
        </p>
      </CardContent>
    </Card>
  );
}
