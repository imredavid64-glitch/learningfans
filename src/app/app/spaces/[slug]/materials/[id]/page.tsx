import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashcardReview } from "@/components/materials/flashcard-review";

export default async function FlashcardReviewPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("title, metadata, type")
    .eq("id", id)
    .single();

  if (!material || material.type !== "flashcard_set") notFound();

  const cards =
    (material.metadata as { cards?: { front: string; back: string }[] })?.cards ??
    [];

  return (
    <div className="space-y-6">
      <Link
        href={`/app/spaces/${slug}/materials`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Materials
      </Link>
      <h1 className="text-2xl font-bold">{material.title}</h1>
      <FlashcardReview cards={cards} />
    </div>
  );
}
