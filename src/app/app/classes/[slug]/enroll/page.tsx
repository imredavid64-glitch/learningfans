import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { enrollInClass } from "@/actions/enrollments";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, BookOpen, Users, Calendar } from "lucide-react";

interface EnrollPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EnrollPage({ params }: EnrollPageProps) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`/login?redirect=/app/classes/${slug}/enroll`);
  }

  const supabase = await createClient();

  // Get class details
  const { data: classData } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!classData) {
    return notFound();
  }

  // Check if already enrolled
  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", classData.id)
    .eq("student_id", profile.id)
    .single();

  if (enrollment) {
    redirect(`/app/classes/${slug}?already_enrolled=true`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Enroll in {classData.name}</h1>
        <p className="text-muted-foreground mt-2">
          Join this class to access materials, discussions, and assignments
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle>{classData.name}</CardTitle>
              <CardDescription>
                {classData.class_code && <span className="mr-2">{classData.class_code}</span>}
                {classData.semester && <span className="mr-2">{classData.semester}</span>}
                {classData.department && <span className="mr-2">{classData.department}</span>}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {classData.instructor && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Instructor: {classData.instructor}</span>
              </div>
            )}
            {classData.meeting_schedule && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{classData.meeting_schedule}</span>
              </div>
            )}
            {classData.room && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Room: {classData.room}</span>
              </div>
            )}
            {classData.description && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">{classData.description}</p>
              </div>
            )}
          </div>

          <form action={enrollInClass.bind(null, classData.id)} className="space-y-3">
            {classData.join_password_hash && (
              <input
                type="password"
                name="joinPassword"
                placeholder="Class password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <Button type="submit" className="w-full gap-2" size="lg">
              <CheckCircle2 className="h-4 w-4" />
              Enroll in Class
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            By enrolling, you&apos;ll get access to all class materials, discussions, and assignments.
            You can drop the class at any time from the class settings.
          </p>
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href={`/app/classes/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to class details
        </Link>
      </div>
    </div>
  );
}