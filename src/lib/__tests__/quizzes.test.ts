import { describe, it, expect } from "vitest";
import {
  validateQuizQuestions,
  gradeQuiz,
  MAX_QUIZ_QUESTIONS,
  type QuizQuestion,
} from "@/lib/quizzes";

function q(overrides: Partial<QuizQuestion> = {}): unknown {
  return {
    question: "What is 2+2?",
    options: ["3", "4", "5"],
    answerIndex: 1,
    ...overrides,
  };
}

describe("validateQuizQuestions", () => {
  it("accepts a well-formed quiz", () => {
    const res = validateQuizQuestions([q(), q({ question: "2nd" })]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.questions).toHaveLength(2);
  });

  it("rejects non-arrays, empty and oversized quizzes", () => {
    expect(validateQuizQuestions("nope").ok).toBe(false);
    expect(validateQuizQuestions([]).ok).toBe(false);
    const many = Array.from({ length: MAX_QUIZ_QUESTIONS + 1 }, () => q());
    expect(validateQuizQuestions(many).ok).toBe(false);
  });

  it("trims blank options and requires enough of them", () => {
    expect(validateQuizQuestions([q({ options: ["only one"] })]).ok).toBe(false);
    expect(
      validateQuizQuestions([q({ options: ["a", "  ", "b"] })]).ok,
    ).toBe(true); // blank option trimmed away
  });

  it("rejects missing or out-of-range correct answers", () => {
    expect(validateQuizQuestions([q({ answerIndex: 5 })]).ok).toBe(false);
    expect(validateQuizQuestions([q({ answerIndex: -1 })]).ok).toBe(false);
  });

  it("strips whitespace and caps lengths", () => {
    const res = validateQuizQuestions([
      q({ question: "  spaced  ", explanation: "  why " }),
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.questions[0].question).toBe("spaced");
      expect(res.questions[0].explanation).toBe("why");
    }
  });
});

describe("gradeQuiz", () => {
  const questions: QuizQuestion[] = [
    { question: "a", options: ["1", "2"], answerIndex: 1 },
    { question: "b", options: ["1", "2"], answerIndex: 0 },
    { question: "c", options: ["1", "2", "3"], answerIndex: 2 },
  ];

  it("grades all-correct at 100%", () => {
    expect(gradeQuiz(questions, [1, 0, 2])).toEqual({ correct: 3, total: 3, pct: 100 });
  });

  it("grades partial answers and rounds the pct", () => {
    expect(gradeQuiz(questions, [1, 1, 2])).toEqual({ correct: 2, total: 3, pct: 67 });
  });

  it("counts skipped answers as wrong", () => {
    expect(gradeQuiz(questions, [null, null, null])).toEqual({ correct: 0, total: 3, pct: 0 });
  });
});
