"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { MAX_BIO_LENGTH, MAX_MAJOR_LENGTH, MAX_INTERESTS, MAX_INTEREST_LENGTH } from "@/lib/validation";
import { isAllowedImage } from "@/lib/file-types";

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_SIZE = 256;

function cleanInterests(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ]
    .slice(0, MAX_INTERESTS)
    .map((s) => s.slice(0, MAX_INTEREST_LENGTH));
}

function publicAvatarUrl(userId: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/avatar.jpg`;
}

export async function updateProfile(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const update: Record<string, unknown> = {};

  const displayName = String(formData.get("displayName") ?? "").trim();
  const major = String(formData.get("major") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const interests = cleanInterests(String(formData.get("interests") ?? ""));

  if (displayName && displayName.length <= 50) update.display_name = displayName;
  if (major.length <= MAX_MAJOR_LENGTH) update.major = major || null;
  if (bio.length <= MAX_BIO_LENGTH) update.bio = bio || null;
  update.interests = interests;

  const { error } = await supabase.from("profiles").update(update).eq("id", profile.id);
  if (error) return;

  revalidatePath("/app/settings");
  revalidatePath(`/app/profile/${profile.id}`);
}

export async function uploadAvatar(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return;
  if (file.size > MAX_AVATAR_SIZE_BYTES) return;
  if (!isAllowedImage(file.type)) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const resized = Buffer.from(
    await sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer(),
  );

  const path = `${profile.id}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, resized, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return;

  const avatarUrl = publicAvatarUrl(profile.id);
  await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);

  revalidatePath("/app/settings");
  revalidatePath(`/app/profile/${profile.id}`);
}

export async function removeAvatar(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const path = `${profile.id}/avatar.jpg`;
  await supabase.storage.from("avatars").remove([path]);
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);

  revalidatePath("/app/settings");
  revalidatePath(`/app/profile/${profile.id}`);
}