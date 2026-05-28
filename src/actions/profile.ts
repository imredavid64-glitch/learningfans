"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function updateProfile(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const displayName = String(formData.get("displayName") ?? "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", profile.id);

  if (error) return;
  revalidatePath("/app/settings");
}
