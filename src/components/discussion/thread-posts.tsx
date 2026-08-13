"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { createPost, markOfficialAnswer } from "@/actions/discussion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CornerDownRight, CheckCircle2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post, Profile } from "@/types/database";

type PostWithAuthor = Post & { profiles: Pick<Profile, "display_name"> | null };

/** Visual nesting cap — deeper chains render at the max indent (data tree is unlimited). */
const MAX_INDENT_LEVEL = 3;

export function ThreadPosts({
  threadId,
  initialPosts,
  isLocked,
  acceptedAnswerId,
  canMarkAnswer,
  isQuestion,
}: {
  threadId: string;
  initialPosts: PostWithAuthor[];
  isLocked: boolean;
  acceptedAnswerId?: string | null;
  canMarkAnswer?: boolean;
  isQuestion?: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [acceptedId, setAcceptedId] = useState<string | null>(acceptedAnswerId ?? null);
  const [marking, setMarking] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const newPost = payload.new as Post;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", newPost.author_id)
            .single();
          setPosts((prev) => [
            ...prev,
            { ...newPost, profiles: profile },
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  // Build the reply tree from the flat list (posts arrive flat over realtime).
  const tree = useMemo(() => {
    const children = new Map<string, PostWithAuthor[]>();
    const roots: PostWithAuthor[] = [];
    for (const p of posts) {
      if (p.parent_id && posts.some((x) => x.id === p.parent_id)) {
        const list = children.get(p.parent_id) ?? [];
        list.push(p);
        children.set(p.parent_id, list);
      } else {
        roots.push(p);
      }
    }
    const byDate = (a: PostWithAuthor, b: PostWithAuthor) =>
      a.created_at.localeCompare(b.created_at);
    roots.sort(byDate);
    for (const list of children.values()) list.sort(byDate);
    return { roots, children };
  }, [posts]);

  async function handleSubmit(formData: FormData) {
    formData.set("timestamp", Date.now().toString());
    await createPost(threadId, formData);
    setReplyingTo(null);
  }

  async function handleMarkAnswer(postId: string) {
    setMarking(postId);
    const next = acceptedId === postId ? null : postId;
    const res = await markOfficialAnswer(threadId, next);
    setMarking(null);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't update the answer.");
      return;
    }
    setAcceptedId(next);
    router.refresh();
  }

  function renderPost(post: PostWithAuthor, depth: number) {
    const kids = tree.children.get(post.id) ?? [];
    const isAccepted = acceptedId === post.id;
    return (
      <div key={post.id}>
        <div
          className={cn(
            "rounded-lg border border-border bg-card p-4",
            depth > 0 && "border-l-2 border-l-primary/20",
            isAccepted && "border-green-500/50 bg-green-500/5",
          )}
          style={{ marginLeft: Math.min(depth, MAX_INDENT_LEVEL) * 16 }}
        >
          {isAccepted && (
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Official answer
            </div>
          )}
          <div className="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="truncate">
              <Link
                href={`/app/profile/${post.author_id}`}
                className="hover:underline"
              >
                {post.profiles?.display_name ?? "Unknown"}
              </Link>
            </span>
            <time>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</time>
          </div>
          <p className="whitespace-pre-wrap text-sm">{post.body}</p>
          {isQuestion && canMarkAnswer && (
            <div className="mt-2">
              <Button
                size="sm"
                variant={isAccepted ? "default" : "ghost"}
                className={cn(
                  "gap-1.5 text-xs",
                  isAccepted ? "bg-green-600 text-white hover:bg-green-700" : "text-muted-foreground",
                )}
                disabled={marking === post.id}
                onClick={() => handleMarkAnswer(post.id)}
              >
                <Check className="h-3.5 w-3.5" />
                {isAccepted ? "Official answer" : "Mark as answer"}
              </Button>
            </div>
          )}
          {!isLocked && (
            <div className="mt-2">
              {replyingTo === post.id ? (
                <form action={handleSubmit} className="space-y-2">
                  <input type="hidden" name="parent_id" value={post.id} />
                  <input
                    type="text"
                    name="website"
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                  <Textarea
                    name="body"
                    placeholder={`Reply to ${post.profiles?.display_name ?? "this comment"}…`}
                    rows={2}
                    required
                  />
                  <div className="flex gap-2">
                    <Button size="sm" type="submit">
                      Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => setReplyingTo(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setReplyingTo(post.id)}
                >
                  <CornerDownRight className="h-3.5 w-3.5" /> Reply
                </Button>
              )}
            </div>
          )}
        </div>
        {kids.length > 0 && (
          <div className="space-y-3">
            {kids.map((kid) => renderPost(kid, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {tree.roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies yet. Start the discussion!</p>
        ) : (
          tree.roots.map((post) => renderPost(post, 0))
        )}
      </div>
      {!isLocked && (
        <form action={handleSubmit} className="space-y-2">
          <input type="hidden" name="parent_id" value="" />
          <input
            type="text"
            name="website"
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />
          <Textarea name="body" placeholder="Write a reply…" required rows={3} />
          <Button type="submit">Reply</Button>
        </form>
      )}
      {isLocked && (
        <p className="text-sm text-muted-foreground">This thread is locked.</p>
      )}
    </div>
  );
}
