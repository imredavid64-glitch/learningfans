"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import {
  ALLOWED_FILE_MIME_TYPES,
  MAX_CARD_TEXT_LENGTH,
  MAX_DECK_METADATA_BYTES,
  MAX_FILE_SIZE_BYTES,
  MAX_FLASHCARDS_PER_SET,
  MAX_NOTE_SIZE_BYTES,
  USER_STORAGE_QUOTA_BYTES,
} from "@/lib/constants";
import type { MaterialPriority, MaterialType } from "@/lib/constants";

export async function createLinkMaterial(
  spaceSlug: string,
  formData: FormData,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlug)
    .single();

  if (!space) return;

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!membership) return;

  const { error } = await supabase.from("study_materials").insert({
    space_id: space.id,
    author_id: profile.id,
    type: "link" as MaterialType,
    title,
    url,
    description: description || null,
  });

  if (error) return;
  await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: 15,
    p_reason: "create_material",
  });
  revalidatePath(`/app/spaces/${spaceSlug}/materials`);
}

export async function createNoteMaterial(
  spaceSlug: string,
  formData: FormData,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (content.length > MAX_NOTE_SIZE_BYTES) {
    return;
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlug)
    .single();

  if (!space) return;

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!membership) return;

  const { error } = await supabase.from("study_materials").insert({
    space_id: space.id,
    author_id: profile.id,
    type: "note" as MaterialType,
    title,
    description: content,
    metadata: { content },
  });

  if (error) return;
  await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: 15,
    p_reason: "create_material",
  });
  revalidatePath(`/app/spaces/${spaceSlug}/materials`);
}

export async function createFlashcardMaterial(
  spaceSlug: string,
  formData: FormData,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const cardsJson = String(formData.get("cards") ?? "[]");

  let cards: { front: string; back: string }[];
  try {
    cards = JSON.parse(cardsJson);
  } catch {
    return;
  }

  if (!Array.isArray(cards)) return;

  if (cards.length > MAX_FLASHCARDS_PER_SET) {
    return;
  }

  // Trim payload: strip whitespace and cap each side so decks stay lean in the DB.
  const cleaned = cards
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      front: String(c.front ?? "").trim().slice(0, MAX_CARD_TEXT_LENGTH),
      back: String(c.back ?? "").trim().slice(0, MAX_CARD_TEXT_LENGTH),
    }))
    .filter((c) => c.front && c.back);

  if (cleaned.length === 0) return;

  if (Buffer.byteLength(JSON.stringify(cleaned), "utf8") > MAX_DECK_METADATA_BYTES) {
    return;
  }
  cards = cleaned;

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlug)
    .single();

  if (!space) return;

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!membership) return;

  const { error } = await supabase.from("study_materials").insert({
    space_id: space.id,
    author_id: profile.id,
    type: "flashcard_set" as MaterialType,
    title,
    metadata: { cards },
  });

  if (error) return;
  await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: 15,
    p_reason: "create_material",
  });
  revalidatePath(`/app/spaces/${spaceSlug}/materials`);
}

export async function uploadFileMaterial(
  spaceSlug: string,
  formData: FormData,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();

  if (!file || file.size === 0) return;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return;
  }
  if (
    !ALLOWED_FILE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_FILE_MIME_TYPES)[number],
    )
  ) {
    return;
  }

  if (profile.storage_used_bytes + file.size > USER_STORAGE_QUOTA_BYTES) {
    return;
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlug)
    .single();

  if (!space) return;

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!membership) return;

  const { data: material, error: matError } = await supabase
    .from("study_materials")
    .insert({
      space_id: space.id,
      author_id: profile.id,
      type: "file" as MaterialType,
      title: title || file.name,
    })
    .select("id")
    .single();

  if (matError || !material) return;

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;

  if (file.type.startsWith("image/")) {
    const compressed = await sharp(buffer)
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    buffer = Buffer.from(compressed);
    contentType = "image/jpeg";
  }

  const path = `${profile.id}/${material.id}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("materials")
    .upload(path, buffer, { contentType, upsert: false });

  if (uploadError) {
    await supabase.from("study_materials").delete().eq("id", material.id);
    return;
  }

  await supabase.from("storage_objects").insert({
    user_id: profile.id,
    bucket: "materials",
    path,
    size_bytes: buffer.length,
    material_id: material.id,
  });

  await supabase
    .from("study_materials")
    .update({ storage_path: path, metadata: { mime: contentType } })
    .eq("id", material.id);

  revalidatePath(`/app/spaces/${spaceSlug}/materials`);
}

export async function toggleUpvote(
  materialId: string,
  spaceSlug: string,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("space_id")
    .eq("id", materialId)
    .maybeSingle();

  if (!material) return;

  const membership = await getSpaceMembership(material.space_id, profile.id);
  if (!membership) return;

  const { data: existing } = await supabase
    .from("material_upvotes")
    .select("material_id")
    .eq("material_id", materialId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("material_upvotes")
      .delete()
      .eq("material_id", materialId)
      .eq("user_id", profile.id);
  } else {
    await supabase.from("material_upvotes").insert({
      material_id: materialId,
      user_id: profile.id,
    });
  }

  revalidatePath(`/app/spaces/${spaceSlug}/materials`);
}

export async function setMaterialPriority(
  materialId: string,
  priority: MaterialPriority,
  dueAt: string | null,
  notes: string | null,
) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("material_priorities").upsert({
    material_id: materialId,
    user_id: profile.id,
    priority,
    due_at: dueAt,
    notes,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
  revalidatePath("/app/priorities");
  return { success: true };
}

export async function getSignedMaterialUrl(storagePath: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("space_id")
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (!material) return { error: "Material not found" };

  const membership = await getSpaceMembership(material.space_id, profile.id);
  if (!membership) return { error: "Not a member of this space" };

  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(storagePath, 3600);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
