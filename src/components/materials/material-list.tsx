"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, FileText, Layers, StickyNote, Zap } from "lucide-react";
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

const typeIcons = {
  file: FileText,
  link: ExternalLink,
  note: StickyNote,
  flashcard_set: Layers,
};

export function MaterialList({
  materials,
  spaceSlug,
  userUpvotes,
}: {
  materials: (StudyMaterial & { profiles?: { display_name: string } })[];
  spaceSlug: string;
  userUpvotes: Set<string>;
}) {
  return (
    <ul className="space-y-3">
      {materials.map((m) => {
        const Icon = typeIcons[m.type];
        const isVip = m.metadata?.is_vip === true;
        return (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
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
              {m.type === "flashcard_set" && (
                <Link href={`/app/spaces/${spaceSlug}/materials/${m.id}`}>
                  <Button size="sm" variant="secondary">
                    Review
                  </Button>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
