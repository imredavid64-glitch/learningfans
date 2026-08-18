// Onboarding checklist — pure derivation, unit-tested. The dashboard feeds in
// cheap counts and renders whatever's still undone as links.

export interface OnboardingInput {
  /** Profile has bio, major, or avatar set. */
  profileComplete: boolean;
  spaceCount: number;
  materialCount: number;
  threadCount: number;
  quizTaken: boolean;
  /** Streak > 0 today (checked in at least once). */
  checkedInToday: boolean;
}

export interface OnboardingItem {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export function buildOnboardingChecklist(input: OnboardingInput): OnboardingItem[] {
  const items: OnboardingItem[] = [
    {
      id: "profile",
      label: "Complete your profile",
      href: "/app/settings",
      done: input.profileComplete,
    },
    {
      id: "join",
      label: "Join your first community",
      href: "/app/spaces",
      done: input.spaceCount > 0,
    },
    {
      id: "material",
      label: "Add your first study material",
      href: "/app/spaces",
      done: input.materialCount > 0,
    },
    {
      id: "discuss",
      label: "Start a discussion",
      href: "/app/spaces",
      done: input.threadCount > 0,
    },
    {
      id: "quiz",
      label: "Take a quiz",
      href: "/app/spaces",
      done: input.quizTaken,
    },
    {
      id: "checkin",
      label: "Check in today",
      href: "/app",
      done: input.checkedInToday,
    },
  ];
  return items;
}

export function onboardingProgress(items: OnboardingItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}