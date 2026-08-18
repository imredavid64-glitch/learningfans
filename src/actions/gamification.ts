"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { LeaderboardEntry, UserStats } from "@/types/database";

export type AwardXpResult = {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  level: number;
  streak_incremented: boolean;
  bonus_xp: number;
};

export async function awardXp(
  amount: number,
  reason: string,
): Promise<{ data?: AwardXpResult; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: amount,
    p_reason: reason,
  });

  if (error) {
    return { error: friendlyRpcError(error.message) };
  }

  revalidatePath("/app");
  return { data: data as AwardXpResult };
}

export async function dailyCheckIn(): Promise<{
  data?: {
    total_xp: number;
    current_streak: number;
    longest_streak: number;
    level: number;
    already_checked_in: boolean;
  };
  error?: string;
}> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_in", {
    p_user_id: profile.id,
  });

  if (error) {
    return { error: friendlyRpcError(error.message) };
  }

  revalidatePath("/app");
  return { data: data as { total_xp: number; current_streak: number; longest_streak: number; level: number; already_checked_in: boolean } };
}

export async function getMyStats(): Promise<UserStats | null> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserStats;
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_limit: limit,
  });

  if (error || !data) return [];
  return (data as LeaderboardEntry[]) ?? [];
}

export async function getWeeklyLeaderboard(limit = 5): Promise<WeeklyLeaderboardEntry[]> {
  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_weekly_leaderboard", {
    p_limit: limit,
  });

  if (error || !data) return [];
  return (data as WeeklyLeaderboardEntry[]) ?? [];
}

export interface WeeklyLeaderboardEntry extends LeaderboardEntry {
  weekly_xp: number;
}

function friendlyRpcError(message: string): string {
  if (message.includes("award_xp") || message.includes("could not find the function")) {
    return "Study stats aren't set up yet — run the study_progress migration in Supabase.";
  }
  return message;
}
