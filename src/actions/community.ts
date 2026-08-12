"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership, isModerator } from "@/lib/auth";
import {
  MAX_RULES,
  MAX_RULE_TITLE,
  MAX_RULE_BODY,
  MAX_ANNOUNCEMENTS,
  MAX_ANNOUNCEMENT_TITLE,
  MAX_ANNOUNCEMENT_BODY,
  type CommunityRule,
  type CommunityAnnouncement,
} from "@/lib/community";

export type CommunityResult = { ok: boolean; error?: string };

export { MAX_RULES, type CommunityRule, type CommunityAnnouncement };

/** Gate: space moderator (space_members.role = 'moderator') or app moderator. */
async function requireSpaceModerator(spaceId: string) {
  const profile = await requireProfile();
  const membership = await getSpaceMembership(spaceId, profile.id);
  if (membership?.role !== "moderator" && !isModerator(profile.role)) {
    throw new Error("Only community moderators can do this.");
  }
  return profile;
}

function isValidRule(rule: unknown): rule is CommunityRule {
  if (!rule || typeof rule !== "object") return false;
  const r = rule as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    r.title.trim().length > 0 &&
    r.title.trim().length <= MAX_RULE_TITLE &&
    (r.body === undefined ||
      r.body === null ||
      (typeof r.body === "string" && r.body.length <= MAX_RULE_BODY))
  );
}

function cleanRule(rule: CommunityRule): CommunityRule {
  return {
    id: rule.id,
    title: rule.title.trim().slice(0, MAX_RULE_TITLE),
    body: (rule.body ?? "").trim().slice(0, MAX_RULE_BODY) || undefined,
  };
}

/** Replace the community rules (moderators only). */
export async function saveCommunityRules(
  spaceId: string,
  rules: unknown,
): Promise<CommunityResult> {
  await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  if (!Array.isArray(rules)) return { ok: false, error: "Rules must be a list." };
  if (rules.length > MAX_RULES) {
    return { ok: false, error: `Communities can have up to ${MAX_RULES} rules.` };
  }
  for (const rule of rules) {
    if (!isValidRule(rule)) {
      return { ok: false, error: "A rule is missing its title or is too long." };
    }
  }

  const cleaned = rules.map(cleanRule);
  const { data: space } = await supabase.from("spaces").select("slug").eq("id", spaceId).single();
  const { error } = await supabase
    .from("spaces")
    .update({ rules: cleaned })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };
  if (space) revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true };
}

/** Post a community announcement (moderators only). */
export async function postAnnouncement(
  spaceId: string,
  title: string,
  body: string,
): Promise<CommunityResult> {
  const profile = await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  const cleanTitle = String(title ?? "").trim();
  const cleanBody = String(body ?? "").trim();
  if (!cleanTitle) return { ok: false, error: "Announcement needs a title." };
  if (cleanTitle.length > MAX_ANNOUNCEMENT_TITLE) {
    return { ok: false, error: `Titles are limited to ${MAX_ANNOUNCEMENT_TITLE} characters.` };
  }
  if (cleanBody.length > MAX_ANNOUNCEMENT_BODY) {
    return { ok: false, error: `Announcements are limited to ${MAX_ANNOUNCEMENT_BODY} characters.` };
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("announcements, name, slug")
    .eq("id", spaceId)
    .single();
  if (!space) return { ok: false, error: "Community not found." };

  const existing = Array.isArray(space.announcements) ? space.announcements : [];
  const announcement: CommunityAnnouncement = {
    id: crypto.randomUUID(),
    title: cleanTitle.slice(0, MAX_ANNOUNCEMENT_TITLE),
    body: cleanBody,
    author_id: profile.id,
    author_name: profile.display_name,
    created_at: new Date().toISOString(),
  };
  const next = [announcement, ...existing].slice(0, MAX_ANNOUNCEMENTS);

  const { error } = await supabase
    .from("spaces")
    .update({ announcements: next })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true };
}

/** Delete a community announcement (moderators only). */
export async function deleteAnnouncement(
  spaceId: string,
  announcementId: string,
): Promise<CommunityResult> {
  await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("announcements, slug")
    .eq("id", spaceId)
    .single();
  if (!space) return { ok: false, error: "Community not found." };

  const existing = Array.isArray(space.announcements) ? space.announcements : [];
  const next = (existing as CommunityAnnouncement[]).filter(
    (a) => a.id !== announcementId,
  );

  const { error } = await supabase
    .from("spaces")
    .update({ announcements: next })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true };
}
