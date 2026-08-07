"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { gradeSchema, validateOrThrow } from "@/lib/validation";

export interface StudentGrade {
  id: string;
  student_id: string;
  assignment_id: string;
  score: number;
  letter_grade: string | null;
  submitted_at: string;
  graded_at: string | null;
  graded_by: string | null;
  feedback: string | null;
  calculated_grade: string | null;
  study_materials: {
    id: string;
    title: string;
    type: string;
    description: string | null;
    space_id: string;
    spaces: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export interface AssignmentMetadata {
  points_possible?: number;
  due_date?: string;
  instructions?: string;
  assignment_details?: boolean;
  [key: string]: unknown;
}

export interface AssignmentWithGrades {
  id: string;
  title: string;
  type: string;
  description: string | null;
  metadata: AssignmentMetadata;
  community_score: number;
  grades: StudentGrade[];
  average_score: number;
  submission_count: number;
}

export async function getStudentGrades(studentId: string): Promise<StudentGrade[]> {
  const supabase = await createClient();

  if (!studentId || typeof studentId !== "string") return [];

  const { data } = await supabase
    .from("grades")
    .select(`
      *,
      study_materials (
        id,
        title,
        type,
        description,
        space_id,
        spaces (
          id,
          name,
          slug
        )
      )
    `)
    .eq("student_id", studentId)
    .order("graded_at", { ascending: false });

  return data || [];
}

export async function getClassGrades(classId: string): Promise<AssignmentWithGrades[]> {
  const supabase = await createClient();

  if (!classId || typeof classId !== "string") return [];

  const { data: assignments } = await supabase
    .from("study_materials")
    .select(`
      id,
      title,
      type,
      description,
      metadata,
      community_score
    `)
    .eq("space_id", classId)
    .eq("type", "flashcard_set")
    .contains("metadata", { assignment_details: true });

  if (!assignments?.length) return [];

  const assignmentIds = assignments.map(a => a.id);
  
  const { data: grades } = await supabase
    .from("grades")
    .select(`
      *,
      profiles (id, display_name, avatar_url),
      study_materials (id, title, type, metadata)
    `)
    .in("assignment_id", assignmentIds);

  const result = assignments.map(assignment => {
    const assignmentGrades = (grades || []).filter(g => g.assignment_id === assignment.id);
    return {
      ...assignment,
      grades: assignmentGrades,
      average_score: assignmentGrades.length > 0 
        ? assignmentGrades.reduce((sum, g) => sum + (g.score || 0), 0) / assignmentGrades.length 
        : 0,
      submission_count: assignmentGrades.length
    };
  });

  return result;
}

export async function createAssignment(classId: string, formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!classId || typeof classId !== "string") {
    redirect("/app/classes?error=Invalid%20class");
  }

  const { data: classData } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", classId)
    .single();

  if (!classData) {
    redirect("/app/classes?error=Class%20not%20found");
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", classId)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin")) {
    redirect(`/app/classes/${classData.slug}?error=Instructor%20only`);
  }

  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointsRaw = String(formData.get("pointsPossible") ?? "100").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!title) {
    redirect(`/app/classes/${classData.slug}/assignments/new?error=Title%20is%20required`);
  }

  const pointsPossible = Number(pointsRaw);
  const metadata: AssignmentMetadata = {
    points_possible: Number.isFinite(pointsPossible) && pointsPossible > 0 ? pointsPossible : 100,
    assignment_details: true,
  };
  if (instructions) metadata.instructions = instructions.slice(0, 5000);
  if (dueDate) metadata.due_date = dueDate;

  const { error } = await supabase.from("study_materials").insert({
    space_id: classId,
    author_id: profile.id,
    type: "flashcard_set" as const,
    title: title.slice(0, 200),
    description: description.slice(0, 2000) || null,
    metadata,
  });

  if (error) {
    redirect(`/app/classes/${classData.slug}/assignments/new?error=${encodeURIComponent(error.message)}`);
  }

  await logAudit("assignment_create", profile.id, { classId, title });

  revalidatePath(`/app/classes/${classData.slug}`);
  redirect(`/app/classes/${classData.slug}/grades`);
}

export async function submitGrade(
  studentId: string,
  assignmentId: string,
  score: number,
  feedback?: string,
  letterGrade?: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await requireProfile();

  try {
    validateOrThrow(gradeSchema, { score, feedback: feedback || "" });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid input" };
  }

  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("study_materials")
    .select("space_id, author_id")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return { success: false, error: "Assignment not found" };
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", assignment.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership || (membership.role !== "moderator" && membership.role !== "admin" && assignment.author_id !== profile.id)) {
    return { success: false, error: "Unauthorized - instructor/moderator required" };
  }

  const calculatedGrade = letterGrade || calculateLetterGrade(score);

  const { error } = await supabase
    .from("grades")
    .upsert({
      student_id: studentId,
      assignment_id: assignmentId,
      score,
      letter_grade: calculatedGrade,
      graded_at: new Date().toISOString(),
      graded_by: profile.id,
      feedback: feedback?.slice(0, 2000) || null,
      calculated_grade: calculatedGrade,
    }, { onConflict: "student_id,assignment_id" });

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit("grade_submit", profile.id, { studentId, assignmentId, score });

  revalidatePath("/app/grades");
  return { success: true };
}

export function calculateLetterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 60) return "D";
  return "F";
}
