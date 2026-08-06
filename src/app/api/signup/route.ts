import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? email.split("@")[0]).trim();

  if (!email || !password) {
    return NextResponse.redirect(new URL("/signup?error=Email%20and%20password%20required", request.url));
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.redirect(new URL("/signup?error=Invalid%20email%20format", request.url));
  }

  if (password.length < 8) {
    return NextResponse.redirect(new URL("/signup?error=Password%20must%20be%20at%20least%208%20characters", request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.redirect(new URL("/login?message=Check%20your%20email%20for%20a%20confirmation%20link", request.url));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get("cookie") || "";
        return cookieHeader.split("; ").filter(Boolean).map((c) => {
          const [name, ...rest] = c.split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return response;
}
