import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { createThread } from "@/actions/discussion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

interface NewThreadPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function NewThreadPage({ params, searchParams }: NewThreadPageProps) {
  const { slug } = await params;
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirect=/app/classes/${slug}/threads/new`);

  const supabase = await createClient();
  const { data: classData } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!classData) return notFound();

  const { data: membership } = await supabase
    .from("space_members")
    .select("id")
    .eq("space_id", classData.id)
    .eq("user_id", profile.id)
    .single();

  if (!membership) {
    redirect(`/app/classes/${slug}?error=You%20must%20be%20a%20member%20to%20post`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/app/classes/${slug}/threads`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to discussions
        </Link>
        <h1 className="text-2xl font-bold mt-2">New Discussion in {classData.name}</h1>
        <p className="text-sm text-muted-foreground">Ask a question or share study notes</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Start a discussion</CardTitle>
          <CardDescription>Choose a clear title so classmates know what it&apos;s about</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createThread.bind(null, classData.id)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} placeholder="e.g. Study tips for the midterm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Details</Label>
              <Textarea id="body" name="body" rows={6} required placeholder="Share your question, notes, or thoughts..." />
            </div>
            <Button type="submit" className="w-full">Post Discussion</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
