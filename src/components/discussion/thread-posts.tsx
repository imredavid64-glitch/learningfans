"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/actions/discussion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post, Profile } from "@/types/database";

type PostWithAuthor = Post & { profiles: Pick<Profile, "display_name"> | null };

/** Visual nesting cap — deeper chains render at the max indent (data tree is unlimited). */
const MAX_INDENT_LEVEL = 3;

export function ThreadPosts({
  threadId,
  initialPosts,
  isLocked,
}: {
  threadId: string;
  initialPosts: PostWithAuthor[];
  isLocked: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

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

  function renderPost(post: PostWithAuthor, depth: number) {
    const kids = tree.children.get(post.id) ?? [];
    return (
      <div key={post.id}>
        <div
          className={cn(
            "rounded-lg border border-border bg-card p-4",
            depth > 0 && "border-l-2 border-l-primary/20",
          )}
          style={{ marginLeft: Math.min(depth, MAX_INDENT_LEVEL) * 16 }}
        >
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
