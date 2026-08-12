"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  CircleHelp,
  ExternalLink,
  FileText,
  Layers,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MaterialType } from "@/lib/constants";

export interface FeedThreadItem {
  id: string;
  title: string;
  body: string | null;
  flair_id: string | null;
  created_at: string;
  score: number;
  spaceSlug: string;
  spaceName: string;
  authorName: string | null;
}

export interface FeedMaterialItem {
  id: string;
  type: MaterialType;
  title: string;
  description: string | null;
  created_at: string;
  spaceSlug: string;
  spaceName: string;
  authorName: string | null;
}

interface FeedEntry {
  key: string;
  kind: "thread" | "material";
  title: string;
  snippet: string | null;
  created_at: string;
  spaceSlug: string;
  spaceName: string;
  authorName: string | null;
  href: string;
  meta: string;
  materialType?: MaterialType;
}

const materialIcons: Record<MaterialType, typeof FileText> = {
  file: FileText,
  link: ExternalLink,
  note: StickyNote,
  flashcard_set: Layers,
  quiz: CircleHelp,
};

const MATERIAL_LABEL: Record<MaterialType, string> = {
  file: "File",
  link: "Link",
  note: "Note",
  flashcard_set: "Flashcards",
  quiz: "Quiz",
};

type FeedFilter = "all" | "threads" | "materials";

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "threads", label: "Discussions" },
  { id: "materials", label: "Materials" },
];

export function CommunityFeed({
  threads,
  materials,
}: {
  threads: FeedThreadItem[];
  materials: FeedMaterialItem[];
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");

  const entries = useMemo<FeedEntry[]>(() => {
    const threadEntries: FeedEntry[] = threads.map((t) => ({
      key: `thread-${t.id}`,
      kind: "thread",
      title: t.title,
      snippet: t.body,
      created_at: t.created_at,
      spaceSlug: t.spaceSlug,
      spaceName: t.spaceName,
      authorName: t.authorName,
      href: `/app/spaces/${t.spaceSlug}/threads/${t.id}`,
      meta: `${t.score} score`,
    }));

    const materialEntries: FeedEntry[] = materials.map((m) => {
      const hasDetailPage =
        m.type === "flashcard_set" || m.type === "quiz" || m.type === "file";
      return {
        key: `material-${m.id}`,
        kind: "material",
        title: m.title,
        snippet: m.description,
        created_at: m.created_at,
        spaceSlug: m.spaceSlug,
        spaceName: m.spaceName,
        authorName: m.authorName,
        href: hasDetailPage
          ? `/app/spaces/${m.spaceSlug}/materials/${m.id}`
          : `/app/spaces/${m.spaceSlug}/materials`,
        meta: MATERIAL_LABEL[m.type],
        materialType: m.type,
      };
    });

    return [...threadEntries, ...materialEntries]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 60);
  }, [threads, materials]);

  const shown = entries.filter((e) =>
    filter === "all" ||
    (filter === "threads" && e.kind === "thread") ||
    (filter === "materials" && e.kind === "material"),
  );

  return (
    <div className="space-y-4">
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

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {entries.length === 0
            ? "Nothing here yet — join a community or start a discussion to fill your feed."
            : "No items in this category yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((e) => {
            const Icon =
              e.kind === "thread"
                ? MessageSquare
                : materialIcons[e.materialType ?? "file"];
            return (
              <li
                key={e.key}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <Link href={e.href} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium hover:underline">{e.title}</p>
                    {e.snippet && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {e.snippet}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.meta} · {e.spaceName} · {e.authorName ?? "Unknown"} ·{" "}
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
