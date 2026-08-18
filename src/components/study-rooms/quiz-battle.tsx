"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studyRoomChannel } from "@/lib/study-room-utils";
import { gradeQuiz, type QuizQuestion } from "@/lib/quizzes";
import { submitQuizResult } from "@/actions/quizzes";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Play, Trophy } from "lucide-react";

/** A question shipped to participants — answers stripped so nobody sees them. */
export interface PublicQuizQuestion {
  question: string;
  options: string[];
}

export interface BattleQuizMeta {
  id: string;
  title: string;
}

interface BattleScore {
  userId: string;
  name: string;
  correct: number;
  total: number;
  pct: number;
}

interface PlayingState {
  phase: "playing";
  battleId: string;
  quiz: BattleQuizMeta;
  questions: PublicQuizQuestion[];
  answers: (number | null)[];
  qIndex: number;
}

type BattleState =
  | { phase: "idle" }
  | PlayingState
  | { phase: "results"; battleId: string; quiz: BattleQuizMeta; myPct: number | null };

interface QuizBattleProps {
  roomId: string;
  userId: string;
  displayName: string;
  disabled?: boolean;
  /** Quizzes the host may start a battle with (public or room-space quizzes). */
  availableQuizzes: BattleQuizMeta[];
}

function makeBattleId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function QuizBattle({
  roomId,
  userId,
  displayName,
  disabled,
  availableQuizzes,
}: QuizBattleProps) {
  const [state, setState] = useState<BattleState>({ phase: "idle" });
  const [picking, setPicking] = useState(false);
  const [loadingPayload, setLoadingPayload] = useState(false);
  const [scores, setScores] = useState<BattleScore[]>([]);
  const [recording, setRecording] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const stateRef = useRef<BattleState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const hostRef = useRef(false); // true when I started the current battle
  const fullQuestionsRef = useRef<QuizQuestion[]>([]); // host-only: real payload for grading
  const myAnswersRef = useRef<(number | null)[]>([]);

  const isPlaying = state.phase === "playing";
  const totalQuestions = isPlaying ? state.questions.length : 0;
  const qIndex = isPlaying ? state.qIndex : 0;
  const question = isPlaying ? state.questions[qIndex] : null;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(studyRoomChannel(roomId));
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "quiz:start" }, ({ payload }) => {
        const p = payload as {
          battleId: string;
          quiz: BattleQuizMeta;
          questions: PublicQuizQuestion[];
        };
        if (!p?.battleId || !Array.isArray(p.questions) || p.questions.length === 0) return;
        if (stateRef.current.phase === "playing" || stateRef.current.phase === "results") return;
        hostRef.current = false;
        setScores([]);
        myAnswersRef.current = Array(p.questions.length).fill(null);
        setState({
          phase: "playing",
          battleId: p.battleId,
          quiz: p.quiz,
          questions: p.questions,
          answers: Array(p.questions.length).fill(null),
          qIndex: 0,
        });
        void hapticLight();
        toast("Quiz battle started — answer to beat the room!");
      })
      .on("broadcast", { event: "quiz:done" }, ({ payload }) => {
        const p = payload as {
          battleId: string;
          userId: string;
          name: string;
          answers: (number | null)[];
        };
        const st = stateRef.current;
        if (st.phase !== "playing" || st.battleId !== p.battleId) return;
        if (!hostRef.current || p.userId === userId) return; // only the host grades others
        if (fullQuestionsRef.current.length === 0) return;
        const grade = gradeQuiz(fullQuestionsRef.current, p.answers ?? []);
        void channel.send({
          type: "broadcast",
          event: "quiz:result",
          payload: {
            battleId: p.battleId,
            userId: p.userId,
            name: p.name,
            correct: grade.correct,
            total: grade.total,
            pct: grade.pct,
          },
        });
      })
      .on("broadcast", { event: "quiz:result" }, ({ payload }) => {
        const p = payload as BattleScore & { battleId: string };
        const st = stateRef.current;
        if ((st.phase !== "playing" && st.phase !== "results") || st.battleId !== p.battleId) return;
        setScores((prev) => {
          const next = prev.filter((s) => s.userId !== p.userId);
          next.push({ userId: p.userId, name: p.name, correct: p.correct, total: p.total, pct: p.pct });
          next.sort((a, b) => b.pct - a.pct || b.correct - a.correct);
          return next;
        });
        if (p.userId === userId && st.phase === "results") {
          setState((prev) =>
            prev.phase === "results" && prev.battleId === p.battleId
              ? { ...prev, myPct: p.pct }
              : prev,
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId]);

  async function startBattle(quiz: BattleQuizMeta) {
    setPicking(false);
    setLoadingPayload(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("study_materials")
        .select("metadata")
        .eq("id", quiz.id)
        .maybeSingle();
      const rawQuestions = (data as { metadata?: { questions?: QuizQuestion[] } } | null)?.metadata
        ?.questions;
      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        toast.error("That quiz has no questions.");
        return;
      }
      const questions = rawQuestions as QuizQuestion[];
      const battleId = makeBattleId();
      hostRef.current = true;
      fullQuestionsRef.current = questions;
      myAnswersRef.current = Array(questions.length).fill(null);
      setScores([]);
      setState({
        phase: "playing",
        battleId,
        quiz,
        questions: questions.map((q) => ({ question: q.question, options: q.options })),
        answers: Array(questions.length).fill(null),
        qIndex: 0,
      });
      void channelRef.current?.send({
        type: "broadcast",
        event: "quiz:start",
        payload: {
          battleId,
          quiz: { id: quiz.id, title: quiz.title },
          questions: questions.map((q) => ({ question: q.question, options: q.options })),
        },
      });
      void hapticSuccess();
    } finally {
      setLoadingPayload(false);
    }
  }

  function pickAnswer(optionIdx: number) {
    if (state.phase !== "playing") return;
    const answers = [...state.answers];
    answers[qIndex] = optionIdx;
    void hapticLight();
    if (qIndex === totalQuestions - 1) {
      finishBattle(answers);
    } else {
      setState({ ...state, answers, qIndex: qIndex + 1 });
    }
  }

  function finishBattle(answers: (number | null)[]) {
    const st = stateRef.current;
    if (st.phase !== "playing") return;
    const battleId = st.battleId;
    myAnswersRef.current = answers;
    setState({ phase: "results", battleId, quiz: st.quiz, myPct: null });

    void channelRef.current?.send({
      type: "broadcast",
      event: "quiz:done",
      payload: { battleId, userId, name: displayName, answers },
    });

    if (hostRef.current) {
      // The host grades their own answers locally (broadcasts are not echoed).
      if (fullQuestionsRef.current.length > 0) {
        const grade = gradeQuiz(fullQuestionsRef.current, answers);
        setScores([
          { userId, name: displayName, correct: grade.correct, total: grade.total, pct: grade.pct },
        ]);
        setState({ phase: "results", battleId, quiz: st.quiz, myPct: grade.pct });
        void channelRef.current?.send({
          type: "broadcast",
          event: "quiz:result",
          payload: { battleId, userId, name: displayName, correct: grade.correct, total: grade.total, pct: grade.pct },
        });
      }
    }
  }

  // Participants auto-record their attempt once their score is revealed
  // (server-authoritative regrade + XP via the existing pipeline).
  const resultPct = state.phase === "results" ? state.myPct : null;
  useEffect(() => {
    const st = stateRef.current;
    if (st.phase !== "results" || st.myPct === null || recording) return;
    if (myAnswersRef.current.length === 0) return;
    setRecording(true);
    void submitQuizResult(st.quiz.id, myAnswersRef.current).then((res) => {
      setRecording(false);
      if (res.ok && res.improved) {
        toast.success(`Attempt recorded — ${res.grade?.pct ?? 0}%`);
      }
    });
  }, [state.phase, resultPct, recording]);

  const myRank = scores.findIndex((s) => s.userId === userId);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold">Quiz Battle</h3>
        {isPlaying && (
          <span className="ml-auto text-xs text-muted-foreground">
            Q {Math.min(qIndex + 1, totalQuestions)}/{totalQuestions}
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        {state.phase === "idle" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Race the room: whoever answers the most correctly wins.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs"
              disabled={disabled || availableQuizzes.length === 0 || loadingPayload}
              onClick={() => setPicking(true)}
            >
              {loadingPayload ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Start Quiz Battle
            </Button>
            {availableQuizzes.length === 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                No quizzes available yet — create one in a community to battle with it.
              </p>
            )}
          </div>
        )}

        {picking && state.phase === "idle" && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pick a quiz
            </p>
            {availableQuizzes.slice(0, 20).map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => void startBattle(q)}
                className="flex w-full items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="truncate">{q.title}</span>
                <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setPicking(false)}
            >
              Cancel
            </Button>
          </div>
        )}

        {isPlaying && question && (
          <div className="space-y-2.5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium">
              {state.quiz.title}
            </div>
            <p className="text-sm font-medium">{question.question}</p>
            <div className="space-y-1.5">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickAnswer(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                    state.answers[qIndex] === i && "border-primary/50 bg-primary/10",
                  )}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>
            {qIndex === totalQuestions - 1 ? (
              <p className="text-[11px] text-muted-foreground">
                Last question — pick an answer to finish.
              </p>
            ) : (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(qIndex / totalQuestions) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {state.phase === "results" && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Results</p>
            {scores.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                Waiting for the room to finish…
              </p>
            ) : (
              <ol className="space-y-1">
                {scores.map((s, i) => (
                  <li
                    key={s.userId}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs",
                      s.userId === userId && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <span className="w-4 text-center font-bold">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {s.name}
                      {s.userId === userId && (
                        <span className="ml-1 text-muted-foreground">(you)</span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {s.correct}/{s.total}
                    </span>
                    <span className="w-10 text-right font-semibold tabular-nums">{s.pct}%</span>
                  </li>
                ))}
              </ol>
            )}
            {myRank >= 0 && (
              <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">
                {myRank === 0 ? "You win the battle! 🏆" : `You placed #${myRank + 1}`}
              </p>
            )}
            {recording ? (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Recording attempt…
              </p>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => {
                  setPicking(false);
                  setScores([]);
                  setState({ phase: "idle" });
                }}
              >
                Close
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}