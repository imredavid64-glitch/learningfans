"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Layers,
  MessageSquare,
  FileText,
  User,
  Presentation,
  Video,
  Calendar,
  Bookmark,
  Users,
  Compass,
  Settings,
  Sparkles,
  Command as CommandIcon,
  Loader2,
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/actions/search";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const QUICK_ACTIONS = [
  { id: "create-room", label: "Create Study Room", icon: Presentation, href: "/app/study-rooms" },
  { id: "new-discussion", label: "Browse Discussions", icon: MessageSquare, href: "/app/feed" },
  { id: "schedule-meeting", label: "Schedule Meeting", icon: Video, href: "/app/meetings" },
  { id: "calendar", label: "View Schedule", icon: Calendar, href: "/app/schedule" },
  { id: "study-groups", label: "Study Groups", icon: Users, href: "/app/groups" },
  { id: "saved-items", label: "Saved Items", icon: Bookmark, href: "/app/saved" },
  { id: "browse-communities", label: "Browse Communities", icon: Compass, href: "/app/communities" },
  { id: "settings", label: "Account Settings", icon: Settings, href: "/app/settings" },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  // Listen for ⌘K / Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearch(trimmed);
        if (!isCancelled) {
          setResults(res);
        }
      } catch (err) {
        console.error("Command palette search error:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    if (!newQuery.trim()) {
      setResults([]);
      setLoading(false);
    }
  };

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  const KIND_ICONS: Record<string, React.ElementType> = {
    space: Layers,
    thread: MessageSquare,
    material: FileText,
    person: User,
  };

  const KIND_BADGES: Record<string, string> = {
    space: "Space",
    thread: "Discussion",
    material: "Material",
    person: "Member",
  };

  return (
    <>
      {/* Trigger Button to show on Navbar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-input bg-background/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search app...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-hidden p-0 shadow-2xl">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              value={query}
              onChange={handleQueryChange}
              placeholder="Type a command, search spaces, discussions, members..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-[350px] overflow-y-auto p-2">
            {/* Quick Actions (when search query is short/empty) */}
            {!query.trim() && (
              <div className="space-y-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Quick Actions & Navigation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleSelect(action.href)}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
                      >
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results */}
            {query.trim().length > 0 && results.length === 0 && !loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No matching results found for &quot;{query}&quot;.
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Search Results ({results.length})
                </div>
                {results.map((item) => {
                  const Icon = KIND_ICONS[item.kind] ?? FileText;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      onClick={() => handleSelect(item.href)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="truncate">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                        {KIND_BADGES[item.kind] ?? item.kind}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              Tip: Press <kbd className="rounded border bg-background px-1 py-0.5">Esc</kbd> to close
            </span>
            <div className="flex items-center gap-1">
              <CommandIcon className="h-3 w-3" /> Command Palette
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
