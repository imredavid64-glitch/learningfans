import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createThread } from "@/actions/discussion";
import { MessageSquare, Plus, Pin, Lock, User, ArrowLeft, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ThreadsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClassThreadsPage({ params }: ThreadsPageProps) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const supabase = await createClient();

  // Get class
  const { data: classData } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!classData) return notFound();

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("*")
    .eq("class_id", classData.id)
    .eq("student_id", profile.id)
    .single();

  const isEnrolled = !!enrollment;

  // Get threads
  const { data: threads } = await supabase
    .from("threads")
    .select(`
      id,
      title,
      body,
      is_pinned,
      is_locked,
      is_hidden,
      created_at,
      updated_at,
      author_id,
      profiles!inner(id, display_name, avatar_url),
      space_members!inner(role)
    `)
    .eq("space_id", classData.id)
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  // Get post counts for each thread
  const threadIds = threads?.map(t => t.id) || [];
  const { data: postCounts } = await supabase
    .from("posts")
    .select("thread_id")
    .in("thread_id", threadIds);

  const postCountMap = new Map();
  postCounts?.forEach(p => {
    postCountMap.set(p.thread_id, (postCountMap.get(p.thread_id) || 0) + 1);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href={`/app/classes/${slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to {classData.name}
          </Link>
          <h1 className="text-3xl font-bold">Discussions</h1>
          <p className="text-muted-foreground mt-1">Ask questions, share insights, and collaborate with classmates</p>
        </div>
        {isEnrolled && (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Discussion
          </Button>
        )}
      </div>

      {/* New Thread Form */}
      {isEnrolled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Start a Discussion
            </CardTitle>
            <CardDescription>Keep it respectful and relevant to the class</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createThread.bind(null, classData.id)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <Input 
                    name="title"
                    placeholder="What's your question or topic?" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Details</label>
                  <Textarea 
                    name="body"
                    placeholder="Add context, code snippets, or details..." 
                    rows={4}
required
                  />
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isPinned" className="rounded" />
                    Pin to top (instructor only)
                  </label>
                </div>
                <Button type="submit" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Post Discussion
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Threads List */}
      <div className="space-y-4">
        {threads?.length ? (
          threads.map((thread) => {
            const postCount = postCountMap.get(thread.id) || 0;
            const author = Array.isArray(thread.profiles) ? thread.profiles[0] : thread.profiles;
            const isAuthor = author.id === profile.id;
            const isPinned = thread.is_pinned;
            const isLocked = thread.is_locked;

            return (
              <Card key={thread.id} className={isPinned ? "border-primary/20 bg-primary/5" : ""}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {isPinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </Badge>
                        )}
                        {isLocked && (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        {thread.is_hidden && (
                          <Badge variant="destructive" className="gap-1">
                            <Flag className="h-3 w-3" />
                            Under Review
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Posted {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <Link 
                        href={`/app/classes/${slug}/threads/${thread.id}`}
                        className="block hover:text-primary transition-colors"
                      >
                        <h3 className="font-semibold text-lg mb-1">{thread.title}</h3>
                      </Link>
                      
                      <p className="text-muted-foreground text-sm line-clamp-2">{thread.body}</p>
                      
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <Link 
                          href={`/app/profile/${author.id}`}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          <User className="h-3.5 w-3.5" />
                          {author.display_name}
                        </Link>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {postCount} replies
                        </span>
                        {isAuthor && (
                          <span className="text-xs text-green-600">Your post</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No discussions yet</h3>
              <p className="text-muted-foreground mt-2">
                {isEnrolled 
                  ? "Be the first to start a discussion!" 
                  : "Enroll in this class to participate in discussions"}
              </p>
              {isEnrolled && (
                <Button className="mt-4 inline-flex gap-2">
                  <Plus className="h-4 w-4" />
                  Start a Discussion
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}