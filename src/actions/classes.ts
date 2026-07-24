"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createClassSchema, validateOrThrow } from "@/lib/validation";

export interface ClassSpace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  class_code: string | null;
  semester: string | null;
  quarter: string | null;
  instructor: string | null;
  department: string | null;
  room: string | null;
  meeting_schedule: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
}

export interface EnrollmentWithSpace {
  id: string;
  class_id: string;
  status: string;
  enrolled_at: string;
  spaces: Partial<ClassSpace>[];
}

export async function getAvailableClasses(): Promise<ClassSpace[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("spaces")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  return data || [];
}

export async function getUserEnrollments(userId: string): Promise<EnrollmentWithSpace[]> {
  const supabase = await createClient();

  if (!userId || typeof userId !== "string") return [];

  const { data } = await supabase
    .from("class_enrollments")
    .select(`
      id,
      class_id,
      status,
      enrolled_at,
      spaces (id, name, slug, class_code, semester, quarter, instructor, department, is_public)
    `)
    .eq("student_id", userId)
    .eq("status", "active");

  return data || [];
}

export async function createClass(
  formData: FormData
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let validated: {
    name: string;
    description: string;
    slug: string;
    classCode: string;
    semester: string;
    instructor: string;
    department: string;
  };

  try {
    validated = validateOrThrow(createClassSchema, {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
      classCode: String(formData.get("classCode") ?? "").trim(),
      semester: String(formData.get("semester") ?? "").trim(),
      instructor: String(formData.get("instructor") ?? "").trim(),
      department: String(formData.get("department") ?? "").trim(),
    });
  } catch (err) {
    redirect(`/app/classes/new?error=${encodeURIComponent(err instanceof Error ? err.message : "Invalid input")}`);
  }

  const { data: space, error } = await supabase
    .from("spaces")
    .insert({
      name: validated.name,
      description: validated.description || null,
      slug: validated.slug,
      is_public: true,
      created_by: profile.id,
      class_code: validated.classCode || null,
      semester: validated.semester || null,
      instructor: validated.instructor || null,
      department: validated.department || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      redirect(`/app/classes/new?error=Slug%20already%20taken`);
    }
    redirect(`/app/classes/new?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("space_members").insert({
    space_id: space.id,
    user_id: profile.id,
    role: "moderator",
  });

  await logAudit("class_create", profile.id, { classId: space.id, name: validated.name, slug: validated.slug });

  revalidatePath("/app/classes");
  redirect(`/app/classes/${space.id}`);
}

export async function enrollInClass(
  classId: string,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!classId || typeof classId !== "string" || classId.length > 100) {
    redirect(`/app/classes?error=Invalid%20class`);
  }

  const { data: existing } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", profile.id)
    .single();

  if (existing) {
    redirect(`/app/classes?error=Already%20enrolled%20in%20this%20class`);
  }

  const { data: classData } = await supabase
    .from("spaces")
    .select("id, name, is_public")
    .eq("id", classId)
    .single();

  if (!classData) {
    redirect(`/app/classes?error=Class%20not%20found`);
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
    redirect(`/app/classes?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("space_members").insert({
    space_id: classId,
    user_id: profile.id,
    role: "member",
    joined_at: new Date().toISOString(),
  });

  await logAudit("class_join", profile.id, { classId, className: classData.name });

  revalidatePath("/app/classes");
  redirect(`/app/classes/${classId}`);
}

export async function dropClass(classId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!classId || typeof classId !== "string") {
    redirect(`/app/classes?error=Invalid%20class`);
  }

  const { error } = await supabase
    .from("class_enrollments")
    .update({ 
      status: "dropped",
      dropped_at: new Date().toISOString()
    })
    .eq("class_id", classId)
    .eq("student_id", profile.id);

  if (error) {
    redirect(`/app/classes?error=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from("space_members")
    .delete()
    .eq("space_id", classId)
    .eq("user_id", profile.id);

  await logAudit("class_leave", profile.id, { classId });

  revalidatePath("/app/classes");
  redirect("/app/classes");
}
