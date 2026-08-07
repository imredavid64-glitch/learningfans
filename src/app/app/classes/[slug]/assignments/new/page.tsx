import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { createAssignment } from "@/actions/grades";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

interface NewAssignmentPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function NewAssignmentPage({ params, searchParams }: NewAssignmentPageProps) {
  const { slug } = await params;
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirect=/app/classes/${slug}/assignments/new`);

  const supabase = await createClient();
  const { data: classData } = await supabase
    .from("spaces")
    .select("id, name, created_by")
    .eq("slug", slug)
    .single();

  if (!classData) return notFound();
  if (classData.created_by !== profile.id) {
    redirect(`/app/classes/${slug}?error=Instructor%20only`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/app/classes/${slug}/grades`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to gradebook
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Assignment in {classData.name}</h1>
        <p className="text-sm text-muted-foreground">Post homework, projects, or graded activities</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assignment details</CardTitle>
          <CardDescription>Students will see this in the gradebook</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAssignment.bind(null, classData.id)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} placeholder="e.g. Midterm Exam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Short description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea id="instructions" name="instructions" rows={5} placeholder="What should students do?" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pointsPossible">Points possible</Label>
                <Input id="pointsPossible" name="pointsPossible" type="number" min={1} defaultValue={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="datetime-local" />
              </div>
            </div>
            <Button type="submit" className="w-full">Create Assignment</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
