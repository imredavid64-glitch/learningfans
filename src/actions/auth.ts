"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { signUpSchema, signInSchema, validateOrThrow } from "@/lib/validation";

export type ActionResult = { redirect?: string; error?: string; message?: string };

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { success } = await rateLimit(3);
  if (!success) {
    return { redirect: "/signup?error=Too%20many%20attempts" };
  }

  let email: string;
  let password: string;
  let displayName: string;
  try {
    ({ email, password, displayName } = validateOrThrow(signUpSchema, {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      displayName: String(formData.get("displayName") ?? "").trim(),
    }));
  } catch (err) {
    return { redirect: `/signup?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { redirect: `/signup?error=${encodeURIComponent(error.message)}` };
  }

  if (data.user) {
    await logAudit("signup", data.user.id, { email });
  }

  if (data.user && !data.session) {
    return { redirect: "/login?message=Check%20your%20email%20for%20a%20confirmation%20link" };
  }

  revalidatePath("/", "layout");
  return { redirect: "/app" };
}

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { success } = await rateLimit(5);
    if (!success) {
      return { redirect: "/login?error=Too%20many%20attempts" };
    }

    let email: string;
    let password: string;
    try {
      ({ email, password } = validateOrThrow(signInSchema, {
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      }));
    } catch (err) {
      return { redirect: `/login?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}` };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { redirect: "/login?error=Invalid%20email%20or%20password" };
    }

    if (data.user) {
      await logAudit("signin", data.user.id, { email });
    }

    revalidatePath("/", "layout");
    return { redirect: "/app" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function signOut(_prev: ActionResult | null, _formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { redirect: "/" };
}
