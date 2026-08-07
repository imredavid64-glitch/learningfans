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
    .select("title, metadata, type, author_id, space_id, created_at")
    .eq("id", id)
    .single();

  if (!material || material.type !== "flashcard_set") notFound();

  // Fetch creator profile
  const { data: creator } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", material.author_id)
    .single();

  const cards =
    (material.metadata as { cards?: { front: string; back: string }[] })?.cards ??
    [];
  const isVip = (material.metadata as { is_vip?: boolean })?.is_vip === true;

  // Generate accent color from space_id for consistent branding
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
          {isVip && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20">
              🔒 VIP Subscriber Content
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300 border border-green-500/20">
            ⚡ Vector Cache (0ms latency | 0 LLM API Cost)
          </span>
        </div>
      </div>
      <FlashcardReview
        cards={cards}
        isVip={isVip}
        creatorName={creator?.display_name || "Creator"}
        creatorAvatar={creator?.avatar_url}
        accentColor={accentColor}
      />
    </div>
  );
}
