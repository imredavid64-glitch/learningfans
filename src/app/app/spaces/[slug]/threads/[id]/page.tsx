import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { hideThread } from "@/actions/discussion";
import { ThreadPosts } from "@/components/discussion/thread-posts";
import { ReportButton } from "@/components/moderation/report-button";
import { ThreadFlairControl } from "@/components/community/thread-flair-control";
import { SaveButton } from "@/components/saved/save-button";
import { HelpCircle, CheckCircle2 } from "lucide-react";
import type { CommunityFlair } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("*, profiles(display_name), spaces(slug, name)")
    .eq("id", id)
    .single();

  if (!thread) notFound();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles(display_name)")
    .eq("thread_id", id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile!.id)
    .maybeSingle();

  const { data: spaceRow } = await supabase
    .from("spaces")
    .select("flairs")
    .eq("id", thread.space_id)
    .single();
  const flairs = (Array.isArray(spaceRow?.flairs) ? spaceRow.flairs : []) as CommunityFlair[];

  const canMod = isModerator(profile!.role) || membership?.role === "moderator";

  // Saved-state for the bookmark button (graceful until migration 0012 lands).
  const { data: savedRow } = await supabase
    .from("saved_items")
    .select("user_id")
    .eq("user_id", profile!.id)
    .eq("item_type", "thread")
    .eq("item_id", id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/spaces/${slug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to {(thread.spaces as { name: string })?.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{thread.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{(thread.profiles as { display_name: string })?.display_name}</span>
          <span>·</span>
          <time>
            {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
          </time>
          <ThreadFlairControl
            threadId={thread.id}
            currentFlairId={thread.flair_id ?? null}
            flairs={flairs}
            canEdit={canMod || thread.author_id === profile!.id}
          />
          {thread.kind === "question" && (
            <Badge variant="secondary" className="gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
              <HelpCircle className="h-3 w-3" /> Question
            </Badge>
          )}
          {thread.kind === "question" && thread.accepted_answer_id && (
            <Badge className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              <CheckCircle2 className="h-3 w-3" /> Answered
            </Badge>
          )}
          {thread.is_locked && <Badge variant="outline">Locked</Badge>}
        </div>
        {thread.body && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-sm">
            {thread.body}
          </p>
        )}
        {thread.kind === "question" && thread.what_tried && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              What I&apos;ve tried
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{thread.what_tried}</p>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <SaveButton itemType="thread" itemId={id} initialSaved={Boolean(savedRow)} />
          <ReportButton targetType="thread" targetId={id} />
          {canMod && (
            <form action={hideThread.bind(null, id, true)}>
              <Button type="submit" variant="destructive" size="sm">
                Hide thread
              </Button>
            </form>
          )}
        </div>
      </div>
      <ThreadPosts
        threadId={id}
        initialPosts={posts ?? []}
        isLocked={thread.is_locked}
        acceptedAnswerId={thread.accepted_answer_id ?? null}
        canMarkAnswer={canMod || thread.author_id === profile!.id}
        isQuestion={thread.kind === "question"}
      />
    </div>
  );
}
