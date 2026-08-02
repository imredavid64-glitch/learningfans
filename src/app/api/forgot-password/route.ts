import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { success } = await rateLimit(3);
  if (!success) {
    return NextResponse.redirect(new URL("/forgot-password?error=Too%20many%20attempts", request.url));
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return NextResponse.redirect(new URL("/forgot-password?error=Email%20required", request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Route the recovery through the already-whitelisted auth callback.
  // The callback exchanges the recovery code for a session, then continues
  // to the client /reset-password page (which reads the session cookies).
  const redirectTo = `${getAppUrl()}/auth/callback?next=/reset-password`;

  const response = NextResponse.redirect(
    new URL("/forgot-password?message=Check%20your%20email%20for%20a%20reset%20link", request.url),
  );

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get("cookie") || "";
        return cookieHeader.split("; ").filter(Boolean).map((c) => {
          const [name, ...rest] = c.split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll() {},
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/forgot-password?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return response;
}