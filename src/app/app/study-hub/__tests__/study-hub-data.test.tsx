import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudyHubData } from "@/app/app/study-hub/study-hub-data";

const fetchMock = vi.fn();

function mockFetchOnce(payload: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const DATA_RESPONSE = {
  status: "ok",
  user: { name: "Aria", major: "Physics", subjects: ["AP Physics", "SAT Prep"] },
  state: {
    state_data: { profile: { name: "Aria", major: "Physics" } },
    last_updated: "2026-08-09T00:00:00Z",
  },
  achievements: [
    { id: "firstTask", title: "First Task", desc: "Complete your first task", icon: "check", earned: true },
    { id: "weekWarrior", title: "Week Warrior", desc: "Study 7 days in a row", icon: "fire", earned: false },
  ],
};

const MATES_RESPONSE = {
  status: "ok",
  yourSubjects: ["AP Physics", "SAT Prep"],
  mates: [
    { id: "mate-1", name: "Bao", major: "Physics", subjects: ["AP Physics"], overlap: ["AP Physics"] },
    { id: "mate-2", name: "Cara", major: "Chemistry", subjects: ["SAT Prep"], overlap: ["SAT Prep"] },
  ],
};

async function loadProfile() {
  render(<StudyHubData />);
  fireEvent.change(screen.getByPlaceholderText("e.g. user_a1b2c3d4"), {
    target: { value: "user_test_123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load data" }));
  await screen.findByText("Profile");
}

describe("StudyHubData — study mates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders mate cards with overlap badges after loading a profile", async () => {
    mockFetchOnce(DATA_RESPONSE);
    mockFetchOnce(MATES_RESPONSE);

    await loadProfile();

    fireEvent.click(screen.getByRole("button", { name: "Find study mates" }));

    expect(await screen.findByText("Bao")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();
    // Overlap badges render inside each mate card.
    expect(screen.getAllByText("AP Physics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SAT Prep").length).toBeGreaterThan(0);
  });

  it("shows the empty state when no other users share subjects", async () => {
    mockFetchOnce(DATA_RESPONSE);
    mockFetchOnce({ status: "ok", mates: [], yourSubjects: ["AP Physics"] });

    await loadProfile();

    fireEvent.click(screen.getByRole("button", { name: "Find study mates" }));

    expect(await screen.findByText(/No matches yet/i)).toBeInTheDocument();
  });

  it("surfaces a missing service key as an inline error, not a silent state", async () => {
    mockFetchOnce({ status: "error", message: "STUDY_HUB_SERVICE_KEY not configured" });

    render(<StudyHubData />);
    fireEvent.change(screen.getByPlaceholderText("e.g. user_a1b2c3d4"), {
      target: { value: "user_test_123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load data" }));

    expect(
      await screen.findByText(/STUDY_HUB_SERVICE_KEY not configured/i),
    ).toBeInTheDocument();
  });

  it("surfaces an invalid-key message from the API", async () => {
    mockFetchOnce({
      status: "error",
      message:
        "Study Hub service key is invalid or expired — update STUDY_HUB_SERVICE_KEY (project nnrdkdisjfudibvrggxb).",
    });

    render(<StudyHubData />);
    fireEvent.change(screen.getByPlaceholderText("e.g. user_a1b2c3d4"), {
      target: { value: "user_test_123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load data" }));

    expect(
      await screen.findByText(/service key is invalid or expired/i),
    ).toBeInTheDocument();
  });
});
