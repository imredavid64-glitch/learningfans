"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Layers, MessageSquare, Search, Users } from "lucide-react";
import { globalSearch, type SearchResult } from "@/actions/search";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const KIND_META: Record<SearchResult["kind"], { icon: typeof Layers; label: string }> = {
  space: { icon: Layers, label: "Spaces" },
  thread: { icon: MessageSquare, label: "Discussions" },
  material: { icon: FileText, label: "Materials" },
  person: { icon: Users, label: "People" },
};

const KIND_ORDER: SearchResult["kind"][] = ["space", "thread", "material", "person"];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    if (timer.current) clearTimeout(timer.current);

    const q = query.trim();
    timer.current = setTimeout(async () => {
      if (q.length < 2) {
        if (!active) return;
        setResults([]);
        setLoading(false);
        setSearched(false);
        return;
      }
      setLoading(true);
      const res = await globalSearch(q);
      if (!active) return;
      setResults(res);
      setLoading(false);
      setSearched(true);
    }, q.length < 2 ? 0 : 300);

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    meta: KIND_META[kind],
    items: results.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search spaces, discussions, materials, people…"
          className="h-11 pl-9 text-base"
          autoFocus
        />
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Searching…</p>
      )}

      {!loading && searched && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No results for “{query.trim()}”. Try a different term or check that you belong to the space.
        </p>
      )}

      {!loading &&
        groups.map(({ kind, meta, items }) => {
          const Icon = meta.icon;
          return (
            <div key={kind}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Icon className="h-4 w-4" />
                {meta.label}
                <Badge variant="outline" className="text-xs">{items.length}</Badge>
              </h2>
              <div className="overflow-hidden rounded-lg border border-border">
                {items.map((r) => (
                  <Link
                    key={`${r.kind}-${r.id}`}
                    href={r.href}
                    className="block border-b border-border/50 px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent"
                  >
                    <span className="block font-medium">{r.title}</span>
                    {r.subtitle && (
                      <span className="block text-xs text-muted-foreground">{r.subtitle}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
