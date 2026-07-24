"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function enrollInClass(
  classId: string,
  _formData?: FormData
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!classId || typeof classId !== "string") {
    redirect("/app/classes?error=Invalid%20class");
  }

  const { data: existing } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", profile.id)
    .single();

  if (existing) {
    redirect(`/app/classes/${classId}?already_enrolled=true`);
  }

  const { data: classData } = await supabase
    .from("spaces")
    .select("*")
    .eq("id", classId)
    .single();

  if (!classData) {
    redirect("/app/classes?error=not_found");
  }

  const { error } = await supabase
    .from("class_enrollments")
    .insert({
      class_id: classId,
      student_id: profile.id,
      status: "active",
      enrolled_at: new Date().toISOString(),
    });

  if (error) {
    redirect(`/app/classes/${classId}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("space_members").insert({
    space_id: classId,
    user_id: profile.id,
    role: "member",
    joined_at: new Date().toISOString(),
  });

  await logAudit("class_join", profile.id, { classId, className: classData.name });

  revalidatePath(`/app/classes/${classData.slug}`);
  revalidatePath("/app/classes");
  
  redirect(`/app/classes/${classData.slug}?enrolled=true`);
}
