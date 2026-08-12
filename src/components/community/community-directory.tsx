"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Search, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface DirectoryCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  icon_url: string | null;
  banner_url: string | null;
  memberCount: number;
  flairCount: number;
  created_at: string;
}

export function CommunityDirectory({
  communities,
}: {
  communities: DirectoryCommunity[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) =>
      [c.name, c.description ?? "", c.slug].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [communities, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search communities by name or topic…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {communities.length === 0
            ? "No communities yet — be the first to create one."
            : "No communities match that search."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/app/spaces/${c.slug}`}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
            >
              <div className="flex items-start gap-3">
                {c.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.icon_url}
                    alt={`${c.name} icon`}
                    className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                    {(c.name ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:underline">{c.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                    {c.flairCount > 0 && (
                      <>
                        {" · "}
                        <Tag className="h-3 w-3" />
                        {c.flairCount} flair{c.flairCount === 1 ? "" : "s"}
                      </>
                    )}
                  </p>
                </div>
                {c.is_public ? (
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Public
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    Private
                  </Badge>
                )}
              </div>
              {c.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {c.description}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Created {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
