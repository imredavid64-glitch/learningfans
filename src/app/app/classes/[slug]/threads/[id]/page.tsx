import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createPost } from "@/actions/discussion";
import { 
  MessageSquare, 
  Send, 
  Flag, 
  Shield, 
  Edit,
  Trash2,
  Lock,
  Pin
} from "lucide-react";

interface ThreadPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { slug, id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const supabase = await createClient();

  // Get thread with author
  const { data: thread } = await supabase
    .from("threads")
    .select(`
      *,
      profiles!inner(display_name, avatar_url, role),
      spaces(id, name, slug)
    `)
    .eq("id", id)
    .eq("spaces.slug", slug)
    .single();

  if (!thread) return notFound();

  const author = Array.isArray(thread.profiles) ? thread.profiles[0] : thread.profiles;
  const space = Array.isArray(thread.spaces) ? thread.spaces[0] : thread.spaces;

  // Get posts with authors
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      profiles!inner(display_name, avatar_url, role)
    `)
    .eq("thread_id", id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });

  // Check membership
  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", thread.space_id)
    .eq("user_id", profile.id)
    .single();

  const isAuthor = thread.author_id === profile.id;
  const isModerator = membership?.role === "moderator" || profile.role === "moderator" || profile.role === "admin";
  const canReply = !!membership && !thread.is_locked;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/app/classes" className="hover:underline">Classes</Link>
        <span>/</span>
        <Link href={`/app/classes/${slug}`} className="hover:underline">{space?.name}</Link>
        <span>/</span>
        <Link href={`/app/classes/${slug}/threads`} className="hover:underline">Discussions</Link>
        <span>/</span>
        <span className="font-medium">{thread.title}</span>
      </nav>

      {/* Thread Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={author?.avatar_url} alt={author?.display_name} />
              <AvatarFallback>{author?.display_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{thread.title}</h1>
                {thread.is_pinned && <Badge variant="secondary" className="text-xs"><Pin className="h-3 w-3 mr-1" />Pinned</Badge>}
                {thread.is_locked && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="font-medium">{author?.display_name}</span>
                <span>•</span>
                <span>{format(new Date(thread.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                {thread.is_locked && (
                  <Badge variant="outline" className="text-xs"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
                )}
              </div>
            </div>
            {(isAuthor || isModerator) && (
              <div className="flex gap-2">
                {thread.is_locked ? (
                  <Button variant="outline" size="sm" disabled>Thread Locked</Button>
                ) : (
                  <Button variant="outline" size="sm">Lock</Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none text-muted-foreground">
            <p className="whitespace-pre-wrap">{thread.body || "No content"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        {posts?.map((post) => {
          const postAuthor = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          const isPostAuthor = post.author_id === profile.id;
          
          return (
            <Card key={post.id} className="relative">
              <CardContent className="pt-4">
                <div className="flex gap-4">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={postAuthor?.avatar_url} alt={postAuthor?.display_name} />
                    <AvatarFallback>{postAuthor?.display_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{postAuthor?.display_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      {isPostAuthor && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{post.body}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <Button variant="ghost" size="sm" className="gap-1 h-8 px-3">
                        <MessageSquare className="h-4 w-4" />
                        Reply
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 h-8 px-3">
                        <Flag className="h-4 w-4" />
                        Report
                      </Button>
                      {(isPostAuthor || isModerator) && (
                        <div className="flex items-center gap-1 ml-auto">
                          <Button variant="ghost" size="sm" className="h-8 px-3">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isModerator && (
                            <Button variant="ghost" size="sm" className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(!posts || posts.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No replies yet. Be the first to respond!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reply Form */}
      {canReply && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Reply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPost.bind(null, id)}>
              <div className="space-y-3">
                <Textarea
                  name="body"
                  placeholder="Write your reply..."
                  className="min-h-[100px] resize-y"
                  required
                />
                <div className="flex justify-end">
                  <Button type="submit" className="gap-2">
                    <Send className="h-4 w-4" />
                    Post Reply
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!canReply && !membership && (
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Join the class to participate</h3>
            <p className="text-muted-foreground mt-2">
              You need to be enrolled in this class to reply to discussions.
            </p>
            <Link href={`/app/classes/${slug}/enroll`} className="mt-4 inline-flex">
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Enroll Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {membership && thread.is_locked && (
        <Card>
          <CardContent className="py-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">This discussion is locked</h3>
            <p className="text-muted-foreground mt-2">
              The instructor has locked this thread. No new replies can be added.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}