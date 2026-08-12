"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, FileText, Layers, StickyNote, Zap, Sparkles, CircleHelp } from "lucide-react";
import { toggleUpvote, setMaterialPriority } from "@/actions/materials";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MaterialPriority } from "@/lib/constants";
import type { StudyMaterial } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/materials/image-lightbox";
import {
  MATERIAL_FILTERS as FILTERS,
  matchesMaterialFilter,
  type MaterialFilter,
} from "@/lib/material-filters";

const typeIcons = {
  file: FileText,
  link: ExternalLink,
  note: StickyNote,
  flashcard_set: Layers,
  quiz: CircleHelp,
};

function LoadSampleMaterialsButton({ onLoad }: { onLoad: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50">
      <p className="text-indigo-900 font-medium mb-4">No study materials in this space yet.</p>
      <Button onClick={onLoad} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
        <Sparkles className="h-4 w-4" />
        Load Sample Creator Study Feed
      </Button>
      <p className="text-sm text-indigo-600 mt-3">Instantly see how study materials work!</p>
    </div>
  );
}

export function MaterialList({
  materials,
  spaceSlug,
  userUpvotes,
}: {
  materials: (StudyMaterial & { profiles?: { display_name: string } })[];
  spaceSlug: string;
  userUpvotes: Set<string>;
}) {
  const [filter, setFilter] = useState<MaterialFilter>("all");
  const handleLoadSample = () => {
    toast.success("Sample creator study feed loaded!");
    // In a real implementation, this would populate the state
    // For now, we just show the toast
  };

  if (materials.length === 0) {
    return <LoadSampleMaterialsButton onLoad={handleLoadSample} />;
  }

  const filtered =
    filter === "all" ? materials : materials.filter((m) => matchesMaterialFilter(m, filter));

  return (
    <div className="space-y-3">
      {/* Reddit-style content filters: find PDFs, images, quizzes… */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing here yet — be the first to share one in this community.
        </p>
      ) : (
        <ul className="space-y-3">
      {filtered.map((m) => {
        const Icon = typeIcons[m.type];
        const isVip = m.metadata?.is_vip === true;
        const isImage = matchesMaterialFilter(m, "image");
        const isPdf = matchesMaterialFilter(m, "pdf");
        const previewUrl = `/app/spaces/${spaceSlug}/materials/${m.id}/preview`;
        return (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              {isImage ? (
                <ImageLightbox
                  src={previewUrl}
                  alt={m.title}
                  title={m.title}
                  triggerClassName="shrink-0"
                  trigger={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={m.title}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  }
                />
              ) : (
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.title}</p>
                  {isVip && (
                    <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                      <span className="text-xs">🔒</span> VIP
                    </Badge>
                  )}
                  {m.type === "flashcard_set" && (
                    <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                      <Zap className="h-3 w-3" /> Vector Cache
                    </Badge>
                  )}
                </div>
                {m.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {m.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.profiles?.display_name} ·{" "}
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{m.type.replace("_", " ")}</Badge>
              <Badge variant="outline">{m.community_score} upvotes</Badge>
              <form action={toggleUpvote.bind(null, m.id, spaceSlug)}>
                <Button type="submit" size="sm" variant="outline">
                  {userUpvotes.has(m.id) ? "Remove upvote" : "Upvote"}
                </Button>
              </form>
              <Select
                onValueChange={(v) =>
                  setMaterialPriority(m.id, v as MaterialPriority, null, null)
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                 </SelectContent>
               </Select>
              {(m.type === "flashcard_set" || m.type === "quiz" || isPdf) && (
                <Link href={`/app/spaces/${spaceSlug}/materials/${m.id}`}>
                  <Button size="sm" variant="secondary">
                    {m.type === "quiz"
                      ? "Take quiz"
                      : m.type === "flashcard_set"
                        ? "Review"
                        : "Preview"}
                  </Button>
                </Link>
              )}
            </div>
          </li>
        );
      })}
        </ul>
      )}
    </div>
  );
}
