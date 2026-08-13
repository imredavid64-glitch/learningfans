"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, ListPlus, RotateCcw, XCircle, Zap } from "lucide-react";
import {
  createQuizReviewDeck,
  getQuizReviewDeck,
  submitQuizResult,
  type SubmitQuizResponse,
} from "@/actions/quizzes";
import type { QuizQuestion } from "@/lib/quizzes";
import { QuizLeaderboard } from "@/components/materials/quiz-leaderboard";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

type Phase = "intro" | "playing" | "done";

export function QuizPlayer({
  materialId,
  questions,
  spaceSlug,
}: {
  materialId: string;
  questions: QuizQuestion[];
  spaceSlug: string;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [addingDeck, setAddingDeck] = useState(false);

  // Answer-time fingerprint: quiz start + per-question first-shown / first-answered.
  const startedAtRef = useRef<number | null>(null);
  const shownAtRef = useRef<(number | null)[]>(questions.map(() => null));
  const answeredAtRef = useRef<(number | null)[]>(questions.map(() => null));

  const missedCount = questions.filter((q, i) => answers[i] !== q.answerIndex).length;

  // On the results screen, detect an existing review deck so the button stays
  // idempotent across reloads ("Review deck" instead of "Add").
  useEffect(() => {
    if (phase !== "done") return;
    let active = true;
    async function load() {
      const res = await getQuizReviewDeck(materialId);
      if (active && res.deckId) setDeckId(res.deckId);
    }
    void load();
    return () => {
      active = false;
    };
  }, [phase, materialId]);

  // Record when each question is first shown (for the answer-time fingerprint).
  useEffect(() => {
    if (phase !== "playing") return;
    if (shownAtRef.current[idx] === null) shownAtRef.current[idx] = Date.now();
  }, [phase, idx]);

  const question = questions[idx];
  const answered = answers.every((a) => a !== null);

  function select(optionIdx: number) {
    if (phase !== "playing") return;
    setAnswers((prev) => prev.map((a, i) => (i === idx ? optionIdx : a)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const totalMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    const answerTimesMs = questions.map((_, i) => {
      const shown = shownAtRef.current[i];
      const answered = answeredAtRef.current[i];
      if (shown == null || answered == null) return null;
      return Math.max(0, answered - shown);
    });
    const res = await submitQuizResult(materialId, answers, { totalMs, answerTimesMs });
    setSubmitting(false);
    if (!res.ok || !res.grade) {
      toast.error(res.error ?? "Couldn't submit your quiz.");
      return;
    }
    setResult(res);
    setPhase("done");
  }

  function retake() {
    setAnswers(questions.map(() => null));
    setIdx(0);
    setResult(null);
    setDeckId(null);
    startedAtRef.current = Date.now();
    shownAtRef.current = questions.map(() => null);
    answeredAtRef.current = questions.map(() => null);
    setPhase("playing");
  }

  async function handleAddToReview() {
    const missed = questions
      .map((_, i) => i)
      .filter((i) => answers[i] !== questions[i].answerIndex);
    if (missed.length === 0) return;
    setAddingDeck(true);
    const res = await createQuizReviewDeck(materialId, missed);
    setAddingDeck(false);
    if (!res.ok || !res.deckId) {
      toast.error(res.error ?? "Couldn't create the review deck.");
      return;
    }
    setDeckId(res.deckId);
    toast.success("Review deck created — your missed questions are now in your queue.");
  }

  return (
    <div className="space-y-5">
      {phase === "intro" && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <h2 className="text-xl font-bold">Community quiz</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {questions.length} question{questions.length === 1 ? "" : "s"} · graded
              instantly · your best score lands on the community leaderboard
            </p>
          </div>
          <Button
            onClick={() => {
              startedAtRef.current = Date.now();
              setPhase("playing");
            }}
          >
            Start quiz
          </Button>
        </div>
      )}

      {phase === "playing" && question && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Question {idx + 1} of {questions.length}
            </span>
            <span className="tabular-nums">
              {answers.filter((a) => a !== null).length}/{questions.length} answered
            </span>
          </div>

          {/* progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            />
          </div>

          <h3 className="text-lg font-semibold">{question.question}</h3>

          <div className="space-y-2">
            {question.options.map((opt, oi) => {
              const selected = answers[idx] === oi;
              return (
                <button
                  key={oi}
                  type="button"
                  onClick={() => {
                    if (answeredAtRef.current[idx] === null) {
                      answeredAtRef.current[idx] = Date.now();
                    }
                    select(oi);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      selected ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {idx < questions.length - 1 ? (
              <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !answered}>
                {submitting ? "Grading…" : "Submit quiz"}
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "done" && result?.grade && (
        <>
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            {result.flagged && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  This attempt was answered too quickly to be fairly graded, so it won&apos;t
                  count toward the leaderboard. Take your time on the next attempt.
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Your score</p>
                <p className="text-3xl font-bold">
                  {result.grade.pct}%
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    {result.grade.correct}/{result.grade.total} correct
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-sm">
                {result.improved ? (
                  <span className="rounded-full bg-green-500/10 px-2.5 py-1 font-medium text-green-700 dark:text-green-300">
                    🎉 New personal best!
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Best: {result.bestPct}% · {result.attempts} attempt
                    {result.attempts === 1 ? "" : "s"}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={retake}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retake
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="min-w-0">
                <p className="font-medium">Review what you missed</p>
                <p className="text-sm text-muted-foreground">
                  {missedCount === 0
                    ? "Perfect score — nothing to review!"
                    : `${missedCount} missed question${missedCount === 1 ? "" : "s"} → an SM-2 flashcard deck you can review anytime.`}
                </p>
              </div>
              {deckId ? (
                <ButtonLink
                  href={`/app/spaces/${spaceSlug}/materials/${deckId}`}
                  size="sm"
                  className="gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Review deck
                </ButtonLink>
              ) : (
                missedCount > 0 && (
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={handleAddToReview}
                    disabled={addingDeck}
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                    {addingDeck ? "Creating deck…" : "Add to my review queue"}
                  </Button>
                )
              )}
            </div>

            <div className="space-y-3">
              {questions.map((q, qi) => {
                const chosen = answers[qi];
                const isCorrect = chosen === q.answerIndex;
                return (
                  <div
                    key={qi}
                    className={cn(
                      "rounded-lg border p-4",
                      isCorrect ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{q.question}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {chosen === null ? "You skipped this one. " : ""}
                          Your answer:{" "}
                          <span className={isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                            {chosen === null ? "—" : q.options[chosen]}
                          </span>
                          {!isCorrect && (
                            <>
                              {" "}· Correct:{" "}
                              <span className="text-green-700 dark:text-green-300">
                                {q.options[q.answerIndex]}
                              </span>
                            </>
                          )}
                        </p>
                        {q.explanation && (
                          <p className="mt-2 rounded-md bg-muted/60 p-2 text-sm">
                            💡 {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <QuizLeaderboard materialId={materialId} />
        </>
      )}
    </div>
  );
}
