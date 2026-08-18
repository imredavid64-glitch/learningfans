// Karma trophies — earned badges derived purely from public stats, so no
// migration or extra storage is needed. Framework-free and unit tested.

export interface Trophy {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export interface TrophyStats {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  /** Profile completeness: bio/major/avatar etc. set. */
  profileComplete: boolean;
  /** Spaces the user belongs to. */
  spaceCount: number;
}

const XP_TROPHIES: { id: string; label: string; description: string; emoji: string; xp: number }[] = [
  { id: "first-steps", label: "First Steps", description: "Earn 100 XP", emoji: "🌱", xp: 100 },
  { id: "centurion", label: "Centurion", description: "Earn 1,000 XP", emoji: "🏅", xp: 1_000 },
  { id: "rising-star", label: "Rising Star", description: "Earn 5,000 XP", emoji: "🌟", xp: 5_000 },
  { id: "legend", label: "Legend", description: "Earn 10,000 XP", emoji: "👑", xp: 10_000 },
];

const STREAK_TROPHIES: { id: string; label: string; description: string; emoji: string; days: number }[] = [
  { id: "warm-up", label: "Warm-Up", description: "7-day study streak", emoji: "🔥", days: 7 },
  { id: "marathoner", label: "Marathoner", description: "30-day longest streak", emoji: "🏃", days: 30 },
];

/**
 * Trophies the user has earned, in display order (milestone first, then
 * streaks, then social). Strictly derived — no state, no side effects.
 */
export function trophiesFor(stats: TrophyStats): Trophy[] {
  const earned: Trophy[] = [];
  for (const t of XP_TROPHIES) {
    if (stats.total_xp >= t.xp) earned.push({ id: t.id, label: t.label, description: t.description, emoji: t.emoji });
  }
  for (const t of STREAK_TROPHIES) {
    if (t.id === "warm-up" ? stats.current_streak >= t.days : stats.longest_streak >= t.days) {
      earned.push({ id: t.id, label: t.label, description: t.description, emoji: t.emoji });
    }
  }
  if (stats.profileComplete) {
    earned.push({ id: "identity", label: "Who Are You?", description: "Complete your profile", emoji: "🪪" });
  }
  if (stats.spaceCount >= 1) {
    earned.push({ id: "joiner", label: "Joiner", description: "Join your first community", emoji: "🤝", });
  }
  if (stats.spaceCount >= 3) {
    earned.push({ id: "community-builder", label: "Community Builder", description: "Belong to 3+ communities", emoji: "🏛️" });
  }
  return earned;
}

/** Next trophy the user can still earn (for the "keep going" nudge), or null. */
export function nextTrophy(stats: TrophyStats): Trophy | null {
  for (const t of XP_TROPHIES) {
    if (stats.total_xp < t.xp) return { id: t.id, label: t.label, description: t.description, emoji: t.emoji };
  }
  for (const t of STREAK_TROPHIES) {
    if (t.id === "warm-up" && stats.current_streak < t.days) {
      return { id: t.id, label: t.label, description: t.description, emoji: t.emoji };
    }
    if (t.id === "marathoner" && stats.longest_streak < t.days) {
      return { id: t.id, label: t.label, description: t.description, emoji: t.emoji };
    }
  }
  return null;
}