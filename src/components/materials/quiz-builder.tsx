"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createQuizMaterial } from "@/actions/quizzes";
import { MAX_QUIZ_QUESTIONS } from "@/lib/quizzes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface BuilderQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export function QuizBuilder({ spaceSlug }: { spaceSlug: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<BuilderQuestion[]>([
    { question: "", options: ["", ""], answerIndex: 0, explanation: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  function updateQuestion(idx: number, patch: Partial<BuilderQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOption(qIdx: number, oIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q,
      ),
    );
  }

  function addQuestion() {
    if (questions.length >= MAX_QUIZ_QUESTIONS) return;
    setQuestions((prev) => [
      ...prev,
      { question: "", options: ["", ""], answerIndex: 0, explanation: "" },
    ]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    const clean = questions.map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()).filter(Boolean),
      answerIndex: q.answerIndex,
      explanation: q.explanation.trim() || undefined,
    }));

    if (!title.trim()) return toast.error("Give the quiz a title.");
    if (clean.some((q) => !q.question)) return toast.error("Every question needs text.");
    if (clean.some((q) => q.options.length < 2)) {
      return toast.error("Every question needs at least two answer options.");
    }
    if (clean.some((q) => q.answerIndex >= q.options.length)) {
      return toast.error("Every question needs the correct answer selected.");
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("questions", JSON.stringify(clean));
    const res = await createQuizMaterial(spaceSlug, formData);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error ?? "Couldn't create the quiz.");
      return;
    }
    toast.success("Quiz posted to the community!");
    setTitle("");
    setQuestions([{ question: "", options: ["", ""], answerIndex: 0, explanation: "" }]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="quiz-title">Quiz title</Label>
        <Input
          id="quiz-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Calculus derivatives — 10 questions"
        />
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {qi + 1}
            </span>
            <Input
              value={q.question}
              onChange={(e) => updateQuestion(qi, { question: e.target.value })}
              maxLength={200}
              placeholder="Question text"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive"
              onClick={() => removeQuestion(qi)}
              disabled={questions.length === 1}
              title="Remove question"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5 pl-8">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.answerIndex === oi}
                  onChange={() => updateQuestion(qi, { answerIndex: oi })}
                  className="h-4 w-4 shrink-0 accent-primary"
                  title="Mark as correct answer"
                />
                <Input
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  maxLength={100}
                  placeholder={`Answer option ${oi + 1}`}
                  className="h-8 flex-1 text-sm"
                />
                {q.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() =>
                      updateQuestion(qi, {
                        options: q.options.filter((_, j) => j !== oi),
                        answerIndex:
                          q.answerIndex === oi ? 0 : q.answerIndex > oi ? q.answerIndex - 1 : q.answerIndex,
                      })
                    }
                    title="Remove option"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {q.options.length < 6 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() =>
                  updateQuestion(qi, { options: [...q.options, ""] })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </Button>
            )}
          </div>

          <Input
            value={q.explanation}
            onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
            maxLength={300}
            placeholder="Explanation shown after answering (optional)"
            className="ml-8 h-8 text-sm"
          />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={addQuestion} disabled={questions.length >= MAX_QUIZ_QUESTIONS}>
          <Plus className="mr-1 h-4 w-4" /> Add question
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Posting…" : "Post quiz to community"}
        </Button>
      </div>
    </div>
  );
}
