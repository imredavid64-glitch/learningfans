// Pure quiz helpers: payload validation + grading. Unit-tested, shared by the
// server actions (authoritative grading) and client components.

import { MAX_DECK_METADATA_BYTES } from "@/lib/constants";

export const MAX_QUIZ_QUESTIONS = 20;
export const MAX_QUESTION_TEXT = 200;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_OPTION_TEXT = 100;
export const MAX_EXPLANATION = 300;

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface QuizPayload {
  questions: QuizQuestion[];
}

export type QuizValidation =
  | { ok: true; questions: QuizQuestion[] }
  | { ok: false; error: string };

export function validateQuizQuestions(raw: unknown): QuizValidation {
  if (!Array.isArray(raw)) return { ok: false, error: "Questions must be a list." };
  if (raw.length === 0) return { ok: false, error: "Add at least one question." };
  if (raw.length > MAX_QUIZ_QUESTIONS) {
    return { ok: false, error: `Quizzes can have up to ${MAX_QUIZ_QUESTIONS} questions.` };
  }

  const questions: QuizQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") return { ok: false, error: "Invalid question." };
    const rec = q as Record<string, unknown>;

    const question = String(rec.question ?? "").trim();
    if (!question) return { ok: false, error: "Every question needs text." };
    if (question.length > MAX_QUESTION_TEXT) {
      return { ok: false, error: `Questions are limited to ${MAX_QUESTION_TEXT} characters.` };
    }

    const options = Array.isArray(rec.options)
      ? rec.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      return {
        ok: false,
        error: `Every question needs ${MIN_OPTIONS}–${MAX_OPTIONS} answer options.`,
      };
    }
    for (const o of options) {
      if (o.length > MAX_OPTION_TEXT) {
        return { ok: false, error: `Answer options are limited to ${MAX_OPTION_TEXT} characters.` };
      }
    }

    const answerIndex = Number(rec.answerIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return { ok: false, error: "Every question needs a correct answer selected." };
    }

    const explanation =
      rec.explanation !== undefined && rec.explanation !== null
        ? String(rec.explanation).trim().slice(0, MAX_EXPLANATION) || undefined
        : undefined;

    questions.push({ question, options, answerIndex, explanation });
  }

  if (Buffer.byteLength(JSON.stringify(questions), "utf8") > MAX_DECK_METADATA_BYTES) {
    return { ok: false, error: "Quiz is too large — trim questions or options." };
  }

  return { ok: true, questions };
}

export interface QuizGrade {
  correct: number;
  total: number;
  pct: number;
}

/**
 * Grade a quiz server-authoritatively. `answers[i]` is the selected option
 * index for question i (null = skipped). Missing answers count as wrong.
 */
export function gradeQuiz(questions: QuizQuestion[], answers: (number | null)[]): QuizGrade {
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].answerIndex) correct++;
  }
  const total = questions.length;
  return { correct, total, pct: total === 0 ? 0 : Math.round((correct / total) * 100) };
}
