"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import {
  gradeQuiz,
  validateQuizQuestions,
  type QuizGrade,
  type QuizQuestion,
} from "@/lib/quizzes";

export type QuizResult = { ok: boolean; error?: string };

export interface QuizAttemptRow {
  material_id: string;
  user_id: string;
  best_score_pct: number;
  best_correct: number;
  best_total: number;
  attempts: number;
  updated_at: string;
  profiles: { display_name: string; avatar_url?: string | null } | null;
}

export async function createQuizMaterial(
  spaceSlug: string,
  formData: FormData,
): Promise<QuizResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const questionsJson = String(formData.get("questions") ?? "[]");

  if (!title) return { ok: false, error: "Give the quiz a title." };

  let raw: unknown;
  try {
    raw = JSON.parse(questionsJson);
  } catch {
    return { ok: false, error: "Invalid quiz data." };
  }

  const validation = validateQuizQuestions(raw);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", spaceSlug)
    .single();
  if (!space) return { ok: false, error: "Community not found." };

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!membership) return { ok: false, error: "You must be a member to post a quiz." };

  const { error } = await supabase.from("study_materials").insert({
    space_id: space.id,
    author_id: profile.id,
    type: "quiz",
    title,
    metadata: { questions: validation.questions },
  });

  if (error) return { ok: false, error: error.message };

  await supabase.rpc("award_xp", {
    p_user_id: profile.id,
    p_amount: 15,
    p_reason: "create_material",
  });
  revalidatePath(`/app/spaces/${spaceSlug}/materials`);
  return { ok: true };
}

export interface SubmitQuizResponse extends QuizResult {
  grade?: QuizGrade;
  improved?: boolean;
  bestPct?: number;
  attempts?: number;
}

/** Grade a submission server-side (authoritative) and record the best attempt. */
export async function submitQuizResult(
  materialId: string,
  answers: (number | null)[],
): Promise<SubmitQuizResponse> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("space_id, is_hidden, metadata")
    .eq("id", materialId)
    .single();

  if (!material || material.is_hidden) return { ok: false, error: "Quiz not found." };
  if (!Array.isArray(material.metadata?.questions)) {
    return { ok: false, error: "This material has no quiz questions." };
  }
  const questions = material.metadata.questions as QuizQuestion[];

  const { data: space } = await supabase
    .from("spaces")
    .select("is_public")
    .eq("id", material.space_id)
    .single();
  const membership = await getSpaceMembership(material.space_id, profile.id);
  if (!space || (!space.is_public && !membership)) {
    return { ok: false, error: "You can't take quizzes in this community." };
  }

  const grade = gradeQuiz(
    questions,
    Array.isArray(answers)
      ? answers.slice(0, questions.length).map((a) => (typeof a === "number" ? a : null))
      : [],
  );

  const { data: existing } = await supabase
    .from("quiz_attempts")
    .select("best_score_pct, best_correct, attempts")
    .eq("material_id", materialId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const improved = !existing || grade.pct > existing.best_score_pct;
  const attempts = (existing?.attempts ?? 0) + 1;

  const { error } = await supabase.from("quiz_attempts").upsert(
    {
      material_id: materialId,
      user_id: profile.id,
      best_score_pct: improved ? grade.pct : (existing?.best_score_pct ?? grade.pct),
      best_correct: improved ? grade.correct : (existing?.best_correct ?? grade.correct),
      best_total: grade.total,
      attempts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "material_id,user_id" },
  );

  if (error) return { ok: false, error: error.message };

  if (improved) {
    await supabase.rpc("award_xp", {
      p_user_id: profile.id,
      p_amount: 5,
      p_reason: "quiz_best",
    });
  }

  revalidatePath(`/app/`);
  return {
    ok: true,
    grade,
    improved,
    bestPct: improved ? grade.pct : (existing?.best_score_pct ?? grade.pct),
    attempts,
  };
}

/** Community leaderboard for a quiz: top 10 + the caller's own best. */
export async function getQuizLeaderboard(
  materialId: string,
): Promise<{ rows: QuizAttemptRow[]; mine: QuizAttemptRow | null }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("quiz_attempts")
    .select("*, profiles(display_name, avatar_url)")
    .eq("material_id", materialId)
    .order("best_score_pct", { ascending: false })
    .limit(20);

  const rows = ((data ?? []) as unknown as QuizAttemptRow[]).map((r) => ({
    ...r,
    profiles: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? null,
  }));

  const mine = rows.find((r) => r.user_id === profile.id) ?? null;
  return { rows: rows.slice(0, 10), mine };
}
