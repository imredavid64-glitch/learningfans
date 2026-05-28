"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/actions/discussion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Post, Profile } from "@/types/database";

type PostWithAuthor = Post & { profiles: Pick<Profile, "display_name"> | null };

export function ThreadPosts({
  threadId,
  spaceSlug,
  initialPosts,
  isLocked,
}: {
  threadId: string;
  spaceSlug: string;
  initialPosts: PostWithAuthor[];
  isLocked: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);

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

  async function handleSubmit(formData: FormData) {
    await createPost(threadId, spaceSlug, formData);
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>{post.profiles?.display_name ?? "Unknown"}</span>
              <time>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm">{post.body}</p>
          </li>
        ))}
      </ul>
      {!isLocked && (
        <form action={handleSubmit} className="space-y-2">
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
