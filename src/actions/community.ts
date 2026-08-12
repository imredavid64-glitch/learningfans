"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership, isModerator } from "@/lib/auth";
import sharp from "sharp";
import {
  MAX_RULES,
  MAX_RULE_TITLE,
  MAX_RULE_BODY,
  MAX_ANNOUNCEMENTS,
  MAX_ANNOUNCEMENT_TITLE,
  MAX_ANNOUNCEMENT_BODY,
  MAX_FLAIRS,
  MAX_BRANDING_IMAGE_BYTES,
  ALLOWED_BRANDING_MIME_TYPES,
  validateFlairs,
  type CommunityRule,
  type CommunityAnnouncement,
  type CommunityFlair,
} from "@/lib/community";
import { validateAutomodRules } from "@/lib/automod";

export type CommunityResult = { ok: boolean; error?: string };

export {
  MAX_RULES,
  MAX_FLAIRS,
  type CommunityRule,
  type CommunityAnnouncement,
  type CommunityFlair,
};

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

export type BrandingKind = "icon" | "banner";

export type BrandingResult = { ok: boolean; error?: string; url?: string };

/** Upload a community icon (square) or banner (wide) image. Moderators only. */
export async function uploadCommunityAsset(
  spaceId: string,
  kind: BrandingKind,
  formData: FormData,
): Promise<BrandingResult> {
  const profile = await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (file.size > MAX_BRANDING_IMAGE_BYTES) {
    return { ok: false, error: "Images are limited to 5 MB." };
  }
  if (!ALLOWED_BRANDING_MIME_TYPES.includes(file.type as (typeof ALLOWED_BRANDING_MIME_TYPES)[number])) {
    return { ok: false, error: "Only PNG, JPEG, or WebP images are supported." };
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  const contentType = "image/jpeg";
  try {
    const compressed = await (kind === "icon"
      ? sharp(buffer).resize({ width: 256, height: 256, fit: "cover" }).jpeg({ quality: 85 }).toBuffer()
      : sharp(buffer).resize({ width: 1600, height: 400, fit: "cover" }).jpeg({ quality: 80 }).toBuffer());
    buffer = Buffer.from(compressed);
  } catch {
    return { ok: false, error: "That file isn't a readable image." };
  }

  const path = `${spaceId}/${kind}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("community-assets")
    .upload(path, buffer, { contentType, upsert: true });
  if (uploadError) return { ok: false, error: uploadError.message };

  await supabase.from("storage_objects").insert({
    user_id: profile.id,
    bucket: "community-assets",
    path,
    size_bytes: buffer.length,
  });

  const publicUrl = supabase.storage.from("community-assets").getPublicUrl(path).data.publicUrl;
  const { data: space } = await supabase.from("spaces").select("slug").eq("id", spaceId).single();
  const { error } = await supabase
    .from("spaces")
    .update(kind === "icon" ? { icon_url: publicUrl } : { banner_url: publicUrl })
    .eq("id", spaceId);

  if (error) {
    await supabase.storage.from("community-assets").remove([path]);
    return { ok: false, error: error.message };
  }
  if (space) revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true, url: publicUrl };
}

/** Remove a community icon/banner (moderators only). */
export async function removeCommunityAsset(
  spaceId: string,
  kind: BrandingKind,
): Promise<CommunityResult> {
  await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  const { data: space } = await supabase.from("spaces").select("slug").eq("id", spaceId).single();
  const { error } = await supabase
    .from("spaces")
    .update(kind === "icon" ? { icon_url: null } : { banner_url: null })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };
  if (space) revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true };
}

/** Replace the community's automod rules (moderators only). */
export async function saveAutomodRules(
  spaceId: string,
  rules: unknown,
): Promise<CommunityResult> {
  await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  const validation = validateAutomodRules(rules);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", spaceId)
    .single();
  const { error } = await supabase
    .from("spaces")
    .update({ automod_rules: validation.rules })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };
  if (space) revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true };
}

/** Replace the community's post flairs (moderators only). */
export async function saveCommunityFlairs(
  spaceId: string,
  flairs: unknown,
): Promise<CommunityResult> {
  await requireSpaceModerator(spaceId);
  const supabase = await createClient();

  const validation = validateFlairs(flairs);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", spaceId)
    .single();
  const { error } = await supabase
    .from("spaces")
    .update({ flairs: validation.flairs })
    .eq("id", spaceId);

  if (error) return { ok: false, error: error.message };
  if (space) revalidatePath(`/app/spaces/${space.slug}`);
  return { ok: true };
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
