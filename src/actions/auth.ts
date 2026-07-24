"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { signUpSchema, signInSchema, validateOrThrow } from "@/lib/validation";

export type AuthState = {
  error?: string;
  message?: string;
};

export async function signUp(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const { success } = await rateLimit(3);
  if (!success) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    const { email, password, displayName } = validateOrThrow(signUpSchema, {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      displayName: String(formData.get("displayName") ?? "").trim(),
    });

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
      return { error: error.message };
    }

    if (data.user) {
      await logAudit("signup", data.user.id, { email });
    }

    if (data.user && !data.session) {
      return {
        message: "Check your email for a confirmation link, then sign in here.",
      };
    }

    revalidatePath("/", "layout");
    redirect("/app");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid input" };
  }
}

export async function signIn(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const { success } = await rateLimit(5);
  if (!success) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    const { email, password } = validateOrThrow(signInSchema, {
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "Invalid email or password" };
    }

    if (data.user) {
      await logAudit("signin", data.user.id, { email });
    }

    revalidatePath("/", "layout");
    redirect("/app");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid input" };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
