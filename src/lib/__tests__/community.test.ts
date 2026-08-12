import { describe, it, expect } from "vitest";
import {
  validateFlairs,
  FLAIR_COLOR_CLASSES,
  FLAIR_COLORS,
  MAX_FLAIRS,
  MAX_FLAIR_LABEL,
} from "@/lib/community";

describe("validateFlairs (community post flairs)", () => {
  it("accepts a valid list and normalizes labels", () => {
    const res = validateFlairs([
      { id: "a", label: "  Homework help ", color: "blue" },
      { label: "Exam prep", color: "red" },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.flairs).toHaveLength(2);
      expect(res.flairs[0]).toEqual({ id: "a", label: "Homework help", color: "blue" });
      expect(res.flairs[1].id).toBeTruthy(); // missing id gets generated
    }
  });

  it("rejects non-list input and empty lists", () => {
    expect(validateFlairs(null).ok).toBe(false);
    expect(validateFlairs({}).ok).toBe(false);
    expect(validateFlairs([]).ok).toBe(true);
  });

  it("rejects missing/blank labels and over-long labels", () => {
    expect(validateFlairs([{ id: "a", label: "", color: "blue" }]).ok).toBe(false);
    expect(validateFlairs([{ id: "a", label: " ".repeat(5), color: "blue" }]).ok).toBe(false);
    expect(
      validateFlairs([{ id: "a", label: "x".repeat(MAX_FLAIR_LABEL + 1), color: "blue" }]).ok,
    ).toBe(false);
    expect(
      validateFlairs([{ id: "a", label: "x".repeat(MAX_FLAIR_LABEL), color: "blue" }]).ok,
    ).toBe(true);
  });

  it("rejects unknown colors and duplicate ids", () => {
    expect(validateFlairs([{ id: "a", label: "X", color: "chartreuse" }]).ok).toBe(false);
    expect(
      validateFlairs([
        { id: "a", label: "X", color: "blue" },
        { id: "a", label: "Y", color: "red" },
      ]).ok,
    ).toBe(false);
  });

  it("enforces the max count", () => {
    const many = Array.from({ length: MAX_FLAIRS + 1 }, (_, i) => ({
      id: `f${i}`,
      label: `Flair ${i}`,
      color: "blue",
    }));
    expect(validateFlairs(many).ok).toBe(false);
    expect(validateFlairs(many.slice(0, MAX_FLAIRS)).ok).toBe(true);
  });

  it("every palette color has badge + swatch classes", () => {
    for (const c of FLAIR_COLORS) {
      expect(FLAIR_COLOR_CLASSES[c.id]).toBeTruthy();
    }
  });
});
