"use client";

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";

export type DemoMode = "off" | "creator" | "fan";

interface DemoModeContextType {
  demoMode: DemoMode;
  setDemoMode: (mode: DemoMode) => void;
  isDemoMode: boolean;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

const STORAGE_KEY = "learningfans-demo-mode";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function getDemoModeSnapshot(): DemoMode {
  if (typeof window === "undefined") return "off";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "creator" || saved === "fan" ? saved : "off";
}

export function getDemoModeServerSnapshot(): DemoMode {
  return "off";
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const demoMode = useSyncExternalStore(subscribe, getDemoModeSnapshot, getDemoModeServerSnapshot);

  const setDemoMode = (mode: DemoMode) => {
    if (mode === "off") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode, isDemoMode: demoMode !== "off" }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
}

export const DEMO_CREATOR_PROFILE = {
  id: "demo-creator-1",
  display_name: "Prof. Sarah Chen",
  avatar_url: null,
  role: "moderator" as const,
  storage_used_bytes: 1024000,
  created_at: "2024-01-15T00:00:00Z",
  major: "Physics & Engineering",
  bio: "AP Physics teacher & curriculum designer. Building the future of STEM education.",
  interests: ["Quantum Mechanics", "Project-Based Learning", "EdTech"],
  current_class_id: "demo-space-1",
  gpa: 0,
  credits_completed: 0,
};

export const DEMO_FAN_PROFILE = {
  id: "demo-fan-1",
  display_name: "David Park",
  avatar_url: null,
  role: "student" as const,
  storage_used_bytes: 512000,
  created_at: "2024-02-01T00:00:00Z",
  major: "Computer Science",
  bio: "High school senior. AP Physics + Calc BC. Aiming for MIT '28.",
  interests: ["Physics", "Programming", "Robotics"],
  current_class_id: "demo-space-1",
  gpa: 3.9,
  credits_completed: 42,
};

export const DEMO_CREATOR_STATS = {
  activeFans: 1240,
  publishedDecks: 47,
  activeChallenges: 12,
  monthlyRevenue: 3840,
  avgQuizCompletion: 88,
  weeklyEngagementHours: 3.4,
};

export const DEMO_FAN_STATS = {
  studyStreak: 12,
  tier: "Gold",
  tierRank: "Top 5%",
  fanXP: 1450,
  badgesEarned: 8,
  quizzesCompleted: 34,
  avgScore: 92,
};

export const DEMO_SPACES = [
  {
    id: "demo-space-1",
    name: "AP Physics C: Mechanics",
    description: "College-level mechanics with calculus. Derivations, problem sets, and AP exam prep.",
    slug: "ap-physics-c-mechanics",
    is_public: true,
    created_by: "demo-creator-1",
    created_at: "2024-01-20T00:00:00Z",
    class_code: "AP-PHYS-C-2024",
    semester: "Fall 2024",
    instructor: "Prof. Sarah Chen",
    department: "Physics",
    room: "Lab 304",
    meeting_schedule: "Mon/Wed/Fri 10:00-11:30 AM",
  },
  {
    id: "demo-space-2",
    name: "AP Physics C: E&M",
    description: "Electromagnetism deep dive. Maxwell's equations, circuits, and field theory.",
    slug: "ap-physics-c-em",
    is_public: true,
    created_by: "demo-creator-1",
    created_at: "2024-01-22T00:00:00Z",
    class_code: "AP-PHYS-EM-2024",
    semester: "Spring 2025",
    instructor: "Prof. Sarah Chen",
    department: "Physics",
    room: "Lab 304",
    meeting_schedule: "Tue/Thu 1:00-2:30 PM",
  },
];

export const DEMO_MATERIALS = [
  {
    id: "demo-material-1",
    space_id: "demo-space-1",
    author_id: "demo-creator-1",
    type: "flashcard_set" as const,
    title: "Kinematics & Derivatives",
    description: "Position, velocity, acceleration relationships. Master the calculus-physics bridge.",
    url: null,
    storage_path: null,
    metadata: { cards: 24, is_vip: false },
    community_score: 89,
    is_hidden: false,
    created_at: "2024-02-01T00:00:00Z",
  },
  {
    id: "demo-material-2",
    space_id: "demo-space-1",
    author_id: "demo-creator-1",
    type: "flashcard_set" as const,
    title: "Newton's Laws Deep Dive",
    description: "Force diagrams, inertial frames, and non-inertial pseudo-forces.",
    url: null,
    storage_path: null,
    metadata: { cards: 18, is_vip: true },
    community_score: 156,
    is_hidden: false,
    created_at: "2024-02-05T00:00:00Z",
  },
  {
    id: "demo-material-3",
    space_id: "demo-space-1",
    author_id: "demo-creator-1",
    type: "note" as const,
    title: "Work-Energy Theorem Derivation",
    description: "Step-by-step derivation from F=ma to W=ΔK. Includes common pitfalls.",
    url: null,
    storage_path: null,
    metadata: {},
    community_score: 67,
    is_hidden: false,
    created_at: "2024-02-10T00:00:00Z",
  },
  {
    id: "demo-material-4",
    space_id: "demo-space-1",
    author_id: "demo-creator-1",
    type: "link" as const,
    title: "PhET Interactive: Forces & Motion",
    description: "Free simulation for visualizing force vectors and motion graphs.",
    url: "https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html",
    storage_path: null,
    metadata: {},
    community_score: 203,
    is_hidden: false,
    created_at: "2024-02-12T00:00:00Z",
  },
];

export const DEMO_CHALLENGES = [
  {
    id: "demo-challenge-1",
    title: "Week 3: Projectile Motion Mastery",
    description: "Score 90%+ on the projectile motion quiz to unlock the 'Trajectory Titan' badge.",
    xp_reward: 100,
    badge: "Trajectory Titan",
    expires_at: "2025-01-20T23:59:59Z",
    participants: 847,
  },
  {
    id: "demo-challenge-2",
    title: "Daily Streak Challenge",
    description: "Maintain a 7-day study streak this week for bonus XP.",
    xp_reward: 50,
    badge: "Streak Keeper",
    expires_at: "2025-01-19T23:59:59Z",
    participants: 1120,
  },
];

export const DEMO_LEADERBOARD = [
  { rank: 1, name: "Alex Chen", weeklyScore: 98, streak: 14, xp: 2100 },
  { rank: 2, name: "Maria Rodriguez", weeklyScore: 96, streak: 12, xp: 1980 },
  { rank: 3, name: "David Park", weeklyScore: 94, streak: 12, xp: 1450 },
  { rank: 4, name: "James Wu", weeklyScore: 92, streak: 10, xp: 1320 },
  { rank: 5, name: "Sarah Kim", weeklyScore: 90, streak: 9, xp: 1180 },
];

export const DEMO_ACTIVITY_FEED = [
  {
    id: "demo-activity-1",
    author: "Prof. Sarah Chen",
    type: "study_drop",
    content: "Just dropped: 'Rotational Dynamics' flashcard set (VIP). 32 cards covering torque, angular momentum, and conservation laws.",
    timestamp: "2 hours ago",
  },
  {
    id: "demo-activity-2",
    author: "Prof. Sarah Chen",
    type: "poll",
    content: "Quick poll: Which topic needs a live review session this Friday?",
    options: ["Rotational Kinematics", "Angular Momentum", "Rolling Motion"],
    timestamp: "5 hours ago",
    votes: [34, 52, 18],
  },
  {
    id: "demo-activity-3",
    author: "Prof. Sarah Chen",
    type: "announcement",
    content: "AP Exam countdown: 42 days. Weekend office hours now open Sat 10-12, Sun 2-4. Bring questions!",
    timestamp: "1 day ago",
  },
];

export const DEMO_QUIZ_QUESTIONS = [
  {
    id: "q1",
    question: "A projectile is launched at 30° above horizontal with initial speed 20 m/s. What is its maximum height? (g = 9.8 m/s²)",
    options: ["5.1 m", "10.2 m", "15.3 m", "20.4 m"],
    correct: 1,
    explanation: "v₀y = 20 sin(30°) = 10 m/s. Max height = v₀y²/2g = 100/19.6 ≈ 5.1 m. Common error: using v₀ instead of v₀y.",
  },
  {
    id: "q2",
    question: "What is the angular acceleration of a disk (I = ½MR²) when a torque τ is applied?",
    options: ["τ/MR²", "2τ/MR²", "τ/2MR²", "4τ/MR²"],
    correct: 1,
    explanation: "α = τ/I = τ/(½MR²) = 2τ/MR². This is why disks accelerate faster than hoops (I=MR²) under the same torque.",
  },
  {
    id: "q3",
    question: "A 2kg block slides down a 30° frictionless incline. What is its acceleration?",
    options: ["4.9 m/s²", "8.5 m/s²", "9.8 m/s²", "17 m/s²"],
    correct: 0,
    explanation: "a = g sin(θ) = 9.8 × sin(30°) = 9.8 × 0.5 = 4.9 m/s². Mass cancels out — all objects accelerate the same on frictionless inclines.",
  },
];