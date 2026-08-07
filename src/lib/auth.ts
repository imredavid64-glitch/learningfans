import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export type SchemaStatus = "ready" | "missing_tables" | "missing_profile";

export async function getSchemaStatus(): Promise<SchemaStatus> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (error?.code === "PGRST205" || error?.message?.includes("schema cache")) {
    return "missing_tables";
  }
  return "ready";
}

export async function ensureProfile(user: User): Promise<Profile | null> {
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Student";

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: displayName,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (!error && data) return data as Profile;
  } catch {
    // Admin client unavailable or table missing
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: user.id, display_name: displayName })
    .select()
    .single();

  if (error) return null;
  return data as Profile;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (data) return data as Profile;

  if (error?.code === "PGRST116") {
    return ensureProfile(user);
  }

  if (error?.code === "PGRST205") {
    return null;
  }

  return null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  return profile;
}

export type SpaceMembershipRole = "member" | "moderator" | "admin";

export async function getSpaceMembership(
  spaceId: string,
  userId: string,
): Promise<{ role: SpaceMembershipRole } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as { role: SpaceMembershipRole } | null;
}

export function isModerator(role: Profile["role"]) {
  return role === "moderator" || role === "admin";
}

export function isAdmin(role: Profile["role"]) {
  return role === "admin";
}
