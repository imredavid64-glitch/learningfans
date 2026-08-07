import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { submitGrade } from "@/actions/grades";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

interface EditGradePageProps {
  params: Promise<{ slug: string; studentId: string; assignmentId: string }>;
}

export default async function EditGradePage({ params }: EditGradePageProps) {
  const { slug, studentId, assignmentId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirect=/app/classes/${slug}/grades/${studentId}/${assignmentId}`);

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

  const [{ data: assignment }, { data: student }, { data: grade }] = await Promise.all([
    supabase.from("study_materials").select("title, metadata").eq("id", assignmentId).single(),
    supabase.from("profiles").select("display_name").eq("id", studentId).single(),
    supabase.from("grades").select("*").eq("student_id", studentId).eq("assignment_id", assignmentId).maybeSingle(),
  ]);

  if (!assignment || !student) return notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/app/classes/${slug}/grades`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to gradebook
        </Link>
        <h1 className="text-2xl font-bold mt-2">Grade {student.display_name}</h1>
        <p className="text-sm text-muted-foreground">
          {assignment.title} ({assignment.metadata?.points_possible || 100} points)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter grade</CardTitle>
          <CardDescription>Points out of {assignment.metadata?.points_possible || 100}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await submitGrade(
                studentId,
                assignmentId,
                Number(formData.get("score")),
                String(formData.get("feedback") ?? ""),
              );
              redirect(`/app/classes/${slug}/grades`);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="score">Score</Label>
              <Input
                id="score"
                name="score"
                type="number"
                min={0}
                max={assignment.metadata?.points_possible || 100}
                step={0.1}
                defaultValue={grade?.score ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (optional)</Label>
              <Textarea id="feedback" name="feedback" rows={4} defaultValue={grade?.feedback ?? ""} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save Grade</Button>
              <Button type="button" variant="outline" onClick={() => redirect(`/app/classes/${slug}/grades`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
