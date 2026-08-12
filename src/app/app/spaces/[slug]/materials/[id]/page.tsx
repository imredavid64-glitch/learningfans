import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Download, FileText } from "lucide-react";
import { FlashcardReview } from "@/components/materials/flashcard-review";
import { QuizPlayer } from "@/components/materials/quiz-player";
import { ImageLightbox } from "@/components/materials/image-lightbox";
import { ButtonLink } from "@/components/ui/button-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
          spaceSlug={slug}
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
      ) : material.type === "file" ? (
        <FilePreview
          materialId={material.id}
          slug={slug}
          title={material.title}
          mime={(material.metadata as { mime?: string } | null)?.mime ?? ""}
        />
      ) : (
        notFound()
      )}
    </div>
  );
}

function FilePreview({
  materialId,
  slug,
  title,
  mime,
}: {
  materialId: string;
  slug: string;
  title: string;
  mime: string;
}) {
  const previewUrl = `/app/spaces/${slug}/materials/${materialId}/preview`;
  const downloadUrl = `/app/classes/${slug}/materials/${materialId}/download`;

  if (mime.startsWith("image/")) {
    return (
      <div className="space-y-4">
        <ImageLightbox
          src={previewUrl}
          alt={title}
          title={title}
          triggerClassName="block w-full"
        />
        <ButtonLink href={downloadUrl} variant="outline" size="sm" className="gap-1">
          <Download className="h-3.5 w-3.5" /> Download image
        </ButtonLink>
      </div>
    );
  }

  if (mime === "application/pdf") {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
          <iframe
            src={previewUrl}
            title={title}
            className="h-[75vh] w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={downloadUrl} variant="outline" size="sm" className="gap-1">
            <Download className="h-3.5 w-3.5" /> Download PDF
          </ButtonLink>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
          >
            <FileText className="h-3.5 w-3.5" /> Open in new tab
          </a>
        </div>
      </div>
    );
  }

  // Other file types: just offer the download.
  return (
    <ButtonLink href={downloadUrl} variant="outline" size="sm" className="gap-1">
      <Download className="h-3.5 w-3.5" /> Download file
    </ButtonLink>
  );
}
