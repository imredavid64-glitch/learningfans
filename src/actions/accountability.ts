"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  ACCOUNTABILITY_MAX_MEMBERS,
  ACCOUNTABILITY_MAX_NAME,
  ACCOUNTABILITY_MAX_GOAL,
  ACCOUNTABILITY_NUDGE_COOLDOWN_HOURS,
} from "@/lib/accountability";

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, ACCOUNTABILITY_MAX_NAME);
}

function cleanGoal(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, ACCOUNTABILITY_MAX_GOAL);
}

/** Create a group and auto-join the creator. */
export async function createAccountabilityGroup(
  name: string,
  weeklyGoal: string,
): Promise<{ ok: boolean; groupId?: string; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const clean = cleanName(name);
  const goal = cleanGoal(weeklyGoal);
  if (!clean) return { ok: false, error: "Give your group a name." };
  if (!goal) return { ok: false, error: "Set a weekly goal (e.g. \"finish Unit 3\")." };

  const { data: group, error } = await supabase
    .from("accountability_groups")
    .insert({ created_by: profile.id, name: clean, weekly_goal: goal })
    .select("id")
    .single();

  if (error || !group) {
    return { ok: false, error: error?.message ?? "Couldn't create the group." };
  }

  await supabase
    .from("accountability_group_members")
    .insert({ group_id: group.id, user_id: profile.id });

  revalidatePath("/app/groups");
  return { ok: true, groupId: group.id };
}

/** Join a group (small groups only). */
export async function joinAccountabilityGroup(
  groupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count } = await supabase
    .from("accountability_group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if ((count ?? 0) >= ACCOUNTABILITY_MAX_MEMBERS) {
    return { ok: false, error: "This group is full (max 8 members)." };
  }

  const { error } = await supabase
    .from("accountability_group_members")
    .upsert({ group_id: groupId, user_id: profile.id }, { onConflict: "group_id,user_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/groups");
  return { ok: true };
}

/** Leave a group. */
export async function leaveAccountabilityGroup(
  groupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("accountability_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/groups");
  return { ok: true };
}

/** Check in for the day in a group (idempotent per day). */
export async function checkInGroup(
  groupId: string,
): Promise<{ ok: boolean; alreadyCheckedIn?: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("accountability_checkins")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", profile.id)
    .eq("checkin_date", today)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("accountability_checkins").insert({
      group_id: groupId,
      user_id: profile.id,
      checkin_date: today,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/app/groups");
  return { ok: true, alreadyCheckedIn: Boolean(existing) };
}

/** Nudge a member (once per cooldown window). Sends a bell notification. */
export async function nudgeMember(
  groupId: string,
  targetUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (targetUserId === profile.id) {
    return { ok: false, error: "You can't nudge yourself." };
  }

  // Cooldown: no repeat nudges within the window.
  const cooldownStart = new Date(
    Date.now() - ACCOUNTABILITY_NUDGE_COOLDOWN_HOURS * 3600_000,
  ).toISOString();
  const { data: recent } = await supabase
    .from("accountability_nudges")
    .select("id")
    .eq("group_id", groupId)
    .eq("from_user", profile.id)
    .eq("to_user", targetUserId)
    .gte("created_at", cooldownStart)
    .limit(1)
    .maybeSingle();
  if (recent) {
    return { ok: false, error: "You already nudged them recently — give them a moment." };
  }

  const { data: group } = await supabase
    .from("accountability_groups")
    .select("name")
    .eq("id", groupId)
    .single();

  const { error } = await supabase.from("accountability_nudges").insert({
    group_id: groupId,
    from_user: profile.id,
    to_user: targetUserId,
  });
  if (error) return { ok: false, error: error.message };

  // Gentle peer nudge through the existing bell.
  await supabase.rpc("create_notification", {
    p_user_id: targetUserId,
    p_title: `${profile.display_name} nudged you`,
    p_body: `Keep the streak alive in ${group?.name ?? "your group"}!`,
    p_type: "nudge",
    p_link: "/app/groups",
    p_actor_id: profile.id,
  });

  revalidatePath("/app/groups");
  return { ok: true };
}
