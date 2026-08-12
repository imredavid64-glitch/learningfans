import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashcardReview } from "@/components/materials/flashcard-review";
import { QuizPlayer } from "@/components/materials/quiz-player";
import type { QuizQuestion } from "@/lib/quizzes";

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("id, title, metadata, type, author_id, space_id, created_at")
    .eq("id", id)
    .single();

  if (!material) notFound();

  // Fetch creator profile
  const { data: creator } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", material.author_id)
    .single();

  const colors = ["indigo", "purple", "blue", "green", "orange", "red"];
  const accentColor = colors[material.space_id.charCodeAt(0) % colors.length];

  return (
    <div className="space-y-6">
      <Link
        href={`/app/spaces/${slug}/materials`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Materials
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{material.title}</h1>
        <div className="flex items-center gap-2">
          {material.type === "flashcard_set" && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300 border border-green-500/20">
              ⚡ Vector Cache (0ms latency | 0 LLM API Cost)
            </span>
          )}
          {material.type === "quiz" && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-sm font-medium text-primary border border-primary/20">
              ⚡ Community quiz
            </span>
          )}
        </div>
      </div>

      {material.type === "quiz" ? (
        <QuizPlayer
          materialId={material.id}
          questions={
            (material.metadata as { questions?: QuizQuestion[] })?.questions ?? []
          }
        />
      ) : material.type === "flashcard_set" ? (
        <FlashcardReview
          cards={
            (material.metadata as { cards?: { front: string; back: string }[] })?.cards ??
            []
          }
          isVip={(material.metadata as { is_vip?: boolean })?.is_vip === true}
          creatorName={creator?.display_name || "Creator"}
          creatorAvatar={creator?.avatar_url}
          accentColor={accentColor}
        />
      ) : (
        notFound()
      )}
    </div>
  );
}
