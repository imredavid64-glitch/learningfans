"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { voteOnThread } from "@/actions/discussion";
import { toggleThreadPin, toggleThreadLock } from "@/actions/discussion";
import { ReportButton } from "@/components/moderation/report-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  rankThreads,
  type ThreadSort,
  type VoteValue,
} from "@/lib/thread-ranking";
import { cn } from "@/lib/utils";
import { FLAIR_COLOR_CLASSES, type CommunityFlair } from "@/lib/community";
import { ArrowDown, ArrowUp, HelpCircle, CheckCircle2 } from "lucide-react";

const SORTS: { id: ThreadSort; label: string }[] = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "top", label: "Top" },
  { id: "controversial", label: "Controversial" },
];

export interface FeedThread {
  id: string;
  title: string;
  flair_id?: string | null;
  kind?: string;
  accepted_answer_id?: string | null;
  is_pinned: boolean;
  is_locked: boolean;
  score: number;
  ups: number;
  downs: number;
  created_at: string;
  profiles: { display_name: string } | null;
}

export function ThreadFeed({
  threads,
  userVotes,
  slug,
  isMod,
  flairs = [],
}: {
  threads: FeedThread[];
  userVotes: Record<string, VoteValue>;
  slug: string;
  isMod: boolean;
  flairs?: CommunityFlair[];
}) {
  const flairMap = new Map(flairs.map((f) => [f.id, f]));
  const router = useRouter();
  const [sort, setSort] = useState<ThreadSort>("hot");
  const [flairId, setFlairId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = flairId ? threads.filter((t) => t.flair_id === flairId) : threads;
  const ranked = rankThreads(filtered, sort);

  async function handleVote(threadId: string, current: VoteValue, direction: 1 | -1) {
    const next: VoteValue = current === direction ? 0 : direction;
    setPendingId(threadId);
    const res = await voteOnThread(threadId, next);
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't update the vote.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Browse by flair (color-coded community labels) */}
      {flairs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFlairId(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !flairId
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            All
          </button>
          {flairs.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFlairId((current) => (current === f.id ? null : f.id))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                FLAIR_COLOR_CLASSES[(f.color ?? "blue") as keyof typeof FLAIR_COLOR_CLASSES],
                flairId === f.id
                  ? "ring-2 ring-ring/60"
                  : "opacity-60 hover:opacity-100",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Reddit-style sort tabs */}
      <div className="flex items-center gap-1 border-b pb-2">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              sort === s.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {flairId ? "No threads with this flair yet — be the first!" : "No threads yet. Start one!"}
        </p>
      ) : (
        ranked.map((t) => {
          const vote = userVotes[t.id] ?? 0;
          return (
            <Card key={t.id} className="flex flex-col sm:flex-row">
              {/* Vote cluster (Reddit-style) */}
              <div className="flex shrink-0 items-center justify-center gap-1 border-b px-2 py-1.5 sm:w-12 sm:flex-col sm:justify-start sm:gap-0.5 sm:border-b-0 sm:border-r sm:py-3">
                <button
                  type="button"
                  disabled={pendingId === t.id}
                  onClick={() => handleVote(t.id, vote, 1)}
                  className={cn(
                    "rounded p-1 transition-colors hover:bg-accent",
                    vote === 1 && "text-primary",
                  )}
                  title="Upvote"
                  aria-label="Upvote"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <span
                  className={cn(
                    "min-w-6 text-center text-sm font-semibold tabular-nums",
                    t.score > 0 ? "text-primary" : t.score < 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {t.score}
                </span>
                <button
                  type="button"
                  disabled={pendingId === t.id}
                  onClick={() => handleVote(t.id, vote, -1)}
                  className={cn(
                    "rounded p-1 transition-colors hover:bg-accent",
                    vote === -1 && "text-destructive",
                  )}
                  title="Downvote"
                  aria-label="Downvote"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <Link
                        href={`/app/spaces/${slug}/threads/${t.id}`}
                        className="hover:underline"
                      >
                        {t.title}
                      </Link>
                    </CardTitle>
                    <div className="flex gap-1">
                      {t.flair_id && flairMap.has(t.flair_id) && (
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            FLAIR_COLOR_CLASSES[
                              (flairMap.get(t.flair_id)?.color ?? "blue") as keyof typeof FLAIR_COLOR_CLASSES
                            ],
                          )}
                        >
                          {flairMap.get(t.flair_id)?.label}
                        </span>
                      )}
                      {t.kind === "question" && (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                        >
                          <HelpCircle className="h-3 w-3" /> Question
                        </Badge>
                      )}
                      {t.kind === "question" && t.accepted_answer_id && (
                        <Badge className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Answered
                        </Badge>
                      )}
                      {t.is_pinned && <Badge>Pinned</Badge>}
                      {t.is_locked && <Badge variant="outline">Locked</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {t.profiles?.display_name} ·{" "}
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </span>
                  <div className="flex gap-2">
                    <ReportButton targetType="thread" targetId={t.id} />
                    {isMod && (
                      <>
                        <form action={toggleThreadPin.bind(null, t.id, !t.is_pinned)}>
                          <Button type="submit" variant="ghost" size="sm">
                            {t.is_pinned ? "Unpin" : "Pin"}
                          </Button>
                        </form>
                        <form action={toggleThreadLock.bind(null, t.id, !t.is_locked)}>
                          <Button type="submit" variant="ghost" size="sm">
                            {t.is_locked ? "Unlock" : "Lock"}
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
