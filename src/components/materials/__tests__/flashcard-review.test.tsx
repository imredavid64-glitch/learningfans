import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardReview } from "@/components/materials/flashcard-review";
import { FLASHCARD_STORAGE_KEY } from "@/lib/flashcard-storage";

vi.mock("@/actions/gamification", () => ({
  awardXp: vi.fn().mockResolvedValue({
    data: { total_xp: 10, current_streak: 1, longest_streak: 1, level: 1, streak_incremented: false, bonus_xp: 0 },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CARDS = [
  { front: "What is 2+2?", back: "4" },
  { front: "Capital of France?", back: "Paris" },
  { front: "H2O is…?", back: "Water" },
];

const MATERIAL_ID = "deck-ui-test";

beforeEach(() => {
  window.localStorage.clear();
});

function renderReviewer() {
  render(<FlashcardReview cards={CARDS} materialId={MATERIAL_ID} creatorName="Mentor" />);
}

describe("FlashcardReview — spaced repetition session", () => {
  it("starts on the first card with due counts", () => {
    renderReviewer();
    expect(screen.getByText("Card 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("3 due now · 0 mastered")).toBeInTheDocument();
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();
  });

  it("flips the card to reveal the back", () => {
    renderReviewer();
    fireEvent.click(screen.getByRole("button", { name: "What is 2+2?" }));
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("advances after Mastered and awards XP", async () => {
    renderReviewer();
    fireEvent.click(screen.getByRole("button", { name: /Mastered/ }));

    expect(await screen.findByText("Card 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    const { awardXp } = await import("@/actions/gamification");
    expect(awardXp).toHaveBeenCalledWith(10, "flashcard_mastered");
  });

  it("requeues a missed card at the end of the session", async () => {
    renderReviewer();
    fireEvent.click(screen.getByRole("button", { name: /Review Again/ }));

    // Card 1 requeued: next up is card 2.
    expect(await screen.findByText("Capital of France?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Got It/ }));
    expect(await screen.findByText("H2O is…?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Got It/ }));
    // The missed card comes back — the only card left in the session.
    expect(await screen.findByText("What is 2+2?")).toBeInTheDocument();
    expect(screen.getByText("1 due now · 0 mastered")).toBeInTheDocument();
  });

  it("shows session complete after clearing the queue", async () => {
    renderReviewer();
    fireEvent.click(screen.getByRole("button", { name: /Mastered/ }));
    await screen.findByText("Card 2 of 3");
    fireEvent.click(screen.getByRole("button", { name: /Mastered/ }));
    await screen.findByText("Card 3 of 3");
    fireEvent.click(screen.getByRole("button", { name: /Mastered/ }));
    expect(await screen.findByText("Session complete!")).toBeInTheDocument();
  });

  it("skips mastered cards loaded from local progress", () => {
    const mastered = {
      easeFactor: 2.6,
      intervalDays: 6,
      repetitions: 5,
      status: "mastered",
      dueAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      lastReviewedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      FLASHCARD_STORAGE_KEY,
      JSON.stringify({ [MATERIAL_ID]: { "0": mastered } }),
    );

    render(<FlashcardReview cards={CARDS} materialId={MATERIAL_ID} creatorName="Mentor" />);

    // Only cards 1 and 2 are in the session.
    expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    expect(screen.queryByText("What is 2+2?")).not.toBeInTheDocument();
    expect(screen.getByText("2 due now · 1 mastered")).toBeInTheDocument();
  });

  it("persists reviews to local storage", () => {
    renderReviewer();
    fireEvent.click(screen.getByRole("button", { name: /Got It/ }));

    const stored = JSON.parse(window.localStorage.getItem(FLASHCARD_STORAGE_KEY) ?? "{}");
    expect(stored[MATERIAL_ID]["0"]).toMatchObject({ repetitions: 1, status: "review" });
  });
});
