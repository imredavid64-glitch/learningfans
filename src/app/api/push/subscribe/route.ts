import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateSubscription } from "@/lib/push";

function sessionSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const header = request.headers.get("cookie") || "";
        return header.split("; ").filter(Boolean).map((c) => {
          const [name, ...rest] = c.split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll() {
        // Read-only route — no cookies to set.
      },
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subscription = (body as { subscription?: unknown })?.subscription;
  if (!validateSubscription(subscription)) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const supabase = sessionSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  // endpoint is unique — replace any previous row for this endpoint.
  await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);

  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    keys: subscription.keys ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
