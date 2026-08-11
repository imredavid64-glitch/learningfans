import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { FlashcardReview } from "@/components/materials/flashcard-review";
import { StudyRoomPresence } from "@/components/materials/study-room-presence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { format } from "date-fns";
import { FileText, Link as LinkIcon, Download } from "lucide-react";

interface MaterialDetailPageProps {
  params: Promise<{ slug: string; id: string }>;
}

const typeLabels: Record<string, string> = {
  file: "File",
  link: "Link",
  note: "Note",
  flashcard_set: "Flashcards",
};

export default async function MaterialDetailPage({ params }: MaterialDetailPageProps) {
  const { slug, id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const supabase = await createClient();
  const { data: material } = await supabase
    .from("study_materials")
    .select("*, profiles(display_name)")
    .eq("id", id)
    .single();

  if (!material) return notFound();

  const author = Array.isArray(material.profiles) ? material.profiles[0] : material.profiles;

  return (
    <div className="space-y-6">
      <Link href={`/app/classes/${slug}/materials`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to materials
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant="secondary" className="text-xs mb-2">
                {typeLabels[material.type] || material.type}
              </Badge>
              <CardTitle className="text-xl">{material.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Shared by {author?.display_name || "Unknown"} · {format(new Date(material.created_at), "MMM d, yyyy")}
              </p>
            </div>
            {material.storage_path && (
              <ButtonLink href={`/app/classes/${slug}/materials/${material.id}/download`} className="gap-1">
                <Download className="h-4 w-4" />
                Download
              </ButtonLink>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {material.description && (
            <p className="text-muted-foreground whitespace-pre-wrap">{material.description}</p>
          )}

          {material.type === "link" && material.url && (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <LinkIcon className="h-4 w-4" />
              {material.url}
            </a>
          )}

          {material.type === "note" && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
              {(material.metadata as { content?: string } | null)?.content}
            </p>
          )}

          {material.type === "file" && material.storage_path && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-4 text-sm">
              <FileText className="h-4 w-4" />
              {material.title}
            </div>
          )}

          {material.type === "flashcard_set" && (
            <div className="space-y-4">
              <StudyRoomPresence
                materialId={material.id}
                userId={profile.id}
                displayName={profile.display_name}
                avatarUrl={profile.avatar_url}
              />
              {material.metadata?.assignment_details ? (
                <p className="text-sm text-muted-foreground">This is an assignment. View it in the Grades section.</p>
              ) : (
                <FlashcardReview
                  cards={(material.metadata as { cards?: { front: string; back: string }[] } | null)?.cards ?? []}
                  materialId={material.id}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
