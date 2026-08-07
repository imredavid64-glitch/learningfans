import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parentEmail, principalEmail } = await request.json();

    if (!parentEmail && !principalEmail) {
      return NextResponse.json(
        { error: "At least one email is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (parentEmail && !emailRegex.test(parentEmail)) {
      return NextResponse.json(
        { error: "Invalid parent email format" },
        { status: 400 }
      );
    }
    if (principalEmail && !emailRegex.test(principalEmail)) {
      return NextResponse.json(
        { error: "Invalid principal email format" },
        { status: 400 }
      );
    }

    // Update profile with emails
    const updateData: Record<string, string | null> = {};
    if (parentEmail) updateData.parent_email = parentEmail;
    if (principalEmail) updateData.principal_email = principalEmail;

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      console.error("Error saving emails:", error);
      return NextResponse.json(
        { error: "Failed to save emails" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Emails saved successfully",
      parentEmail: parentEmail || null,
      principalEmail: principalEmail || null,
    });
  } catch (error) {
    console.error("Error in profanity emails endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
