import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { hideThread } from "@/actions/discussion";
import { ThreadPosts } from "@/components/discussion/thread-posts";
import { ReportButton } from "@/components/moderation/report-button";
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

  const canMod = isModerator(profile!.role);

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
          {thread.is_locked && <Badge variant="outline">Locked</Badge>}
        </div>
        {thread.body && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-sm">
            {thread.body}
          </p>
        )}
        <div className="mt-2 flex gap-2">
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
        spaceSlug={slug}
        initialPosts={posts ?? []}
        isLocked={thread.is_locked}
      />
    </div>
  );
}
