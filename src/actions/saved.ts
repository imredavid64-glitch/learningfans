"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { MAX_COLLECTION_NAME, type SavedItemType } from "@/lib/saved";

export type SaveResult = { ok: boolean; error?: string; saved?: boolean; id?: string };

/** Toggle an item between saved and unsaved (defaults to Uncategorized). */
export async function toggleSaveItem(
  itemType: SavedItemType,
  itemId: string,
): Promise<SaveResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS gates readability of the target, so a missing/unreadable item errors here.
  const table = itemType === "thread" ? "threads" : "study_materials";
  const { data: target } = await supabase
    .from(table)
    .select("id")
    .eq("id", itemId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Item not found." };

  const { data: existing } = await supabase
    .from("saved_items")
    .select("user_id")
    .eq("user_id", profile.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("user_id", profile.id)
      .eq("item_type", itemType)
      .eq("item_id", itemId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, saved: false };
  }

  const { error } = await supabase.from("saved_items").insert({
    user_id: profile.id,
    item_type: itemType,
    item_id: itemId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, saved: true };
}

/** Create a named folder for saved items (form action). */
export async function createSavedCollection(formData: FormData): Promise<void> {
  const clean = String(formData.get("name") ?? "").trim();
  if (!clean || clean.length > MAX_COLLECTION_NAME) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("saved_collections")
    .insert({ user_id: profile.id, name: clean });

  revalidatePath("/app/saved");
}

/** Delete a folder; its items fall back to Uncategorized (FK set null). */
export async function deleteSavedCollection(id: string): Promise<SaveResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("saved_collections")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/saved");
  return { ok: true };
}

/** Move a saved item into a folder (or back to Uncategorized). */
export async function moveSavedItem(
  itemType: SavedItemType,
  itemId: string,
  collectionId: string | null,
): Promise<SaveResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (collectionId) {
    const { data: collection } = await supabase
      .from("saved_collections")
      .select("id")
      .eq("id", collectionId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!collection) return { ok: false, error: "That folder doesn't exist." };
  }

  const { error } = await supabase
    .from("saved_items")
    .update({ collection_id: collectionId })
    .eq("user_id", profile.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/saved");
  return { ok: true };
}
