import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist, onboardingProgress } from "@/lib/onboarding";

const EMPTY: Parameters<typeof buildOnboardingChecklist>[0] = {
  profileComplete: false,
  spaceCount: 0,
  materialCount: 0,
  threadCount: 0,
  quizTaken: false,
  checkedInToday: false,
};

describe("buildOnboardingChecklist", () => {
  it("marks everything undone for a fresh user", () => {
    const items = buildOnboardingChecklist(EMPTY);
    expect(items).toHaveLength(6);
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it("marks each item done from its own input flag", () => {
    const items = buildOnboardingChecklist({ ...EMPTY, spaceCount: 1 });
    expect(items.find((i) => i.id === "join")?.done).toBe(true);
    expect(items.find((i) => i.id === "material")?.done).toBe(false);
  });

  it("counts spaces/materials/threads/quiz via their counts", () => {
    const items = buildOnboardingChecklist({
      ...EMPTY,
      spaceCount: 2,
      materialCount: 1,
      threadCount: 1,
      quizTaken: true,
    });
    const done = items.filter((i) => i.done).map((i) => i.id);
    expect(done).toEqual(["join", "material", "discuss", "quiz"]);
  });

  it("links every item somewhere in-app", () => {
    for (const item of buildOnboardingChecklist(EMPTY)) {
      expect(item.href.startsWith("/app")).toBe(true);
    }
  });
});

describe("onboardingProgress", () => {
  it("is 0 with nothing done and 100 with everything done", () => {
    expect(onboardingProgress(buildOnboardingChecklist(EMPTY))).toBe(0);
    expect(
      onboardingProgress(
        buildOnboardingChecklist({
          profileComplete: true,
          spaceCount: 1,
          materialCount: 1,
          threadCount: 1,
          quizTaken: true,
          checkedInToday: true,
        }),
      ),
    ).toBe(100);
  });

  it("rounds partial progress", () => {
    const items = buildOnboardingChecklist({ ...EMPTY, profileComplete: true, quizTaken: true });
    expect(onboardingProgress(items)).toBe(33);
  });
});