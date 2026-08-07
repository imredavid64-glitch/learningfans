import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data } = await supabase.rpc("get_profanity_status", { p_user_id: user.id });

    if (!data || data.length === 0) {
      return NextResponse.json({
        warnings: 0,
        violations: 0,
        restrictionLevel: "none",
        lastIncidentAt: null,
        parentEmail: null,
        principalEmail: null,
        schoolName: null,
      });
    }

    const status = data[0];

    // Fetch parent/principal emails from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("parent_email, principal_email, school_name")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      warnings: status.profanity_warnings || 0,
      violations: status.profanity_violations || 0,
      restrictionLevel: status.restriction_level || "none",
      lastIncidentAt: status.last_profanity_at,
      parentEmail: profile?.parent_email || null,
      principalEmail: profile?.principal_email || null,
      schoolName: profile?.school_name || null,
    });
  } catch (error) {
    console.error("Error fetching profanity status:", error);
    return NextResponse.json(
      { error: "Failed to fetch profanity status" },
      { status: 500 }
    );
  }
}
