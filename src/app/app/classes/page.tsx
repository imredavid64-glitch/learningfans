import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Plus, Search, Filter, Sparkles } from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeleton";
import { DEMO_SPACES } from "@/lib/demo-data";

async function ClassesContent() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  // Get enrolled classes
  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(`
      class_id,
      status,
      enrolled_at,
      spaces (*)
    `)
    .eq("student_id", profile.id)
    .eq("status", "active");

  // Get all available public classes
  const { data: allClasses } = await supabase
    .from("spaces")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const enrolledClassIds = new Set(enrollments?.map(e => e.class_id) || []);

  const availableClasses = allClasses?.filter(c => !enrolledClassIds.has(c.id)) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your Classes</h1>
          <p className="text-muted-foreground">Manage your class enrollments and discover new classes</p>
        </div>
        <ButtonLink href="/app/classes/browse" className="gap-2">
          <Plus className="h-4 w-4" />
          Browse Classes
        </ButtonLink>
      </div>

      {/* Enrolled Classes */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Enrolled Classes</h2>
        {enrollments?.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => {
              const space = Array.isArray(enrollment.spaces) ? enrollment.spaces[0] : enrollment.spaces;
              if (!space) return null;
              return (
                <Card key={space.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{space.name}</CardTitle>
                        <CardDescription>{space.class_code || space.semester || space.department}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="capitalize">{space.is_public ? "public" : "private"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {space.instructor && (
                      <p className="text-sm text-muted-foreground">
                        Instructor: {space.instructor}
                      </p>
                    )}
                    {space.meeting_schedule && (
                      <p className="text-sm text-muted-foreground">
                        {space.meeting_schedule}
                      </p>
                    )}
                    {space.room && (
                      <p className="text-sm text-muted-foreground">
                        Room: {space.room}
                      </p>
                    )}
                    <Link
                      href={`/app/classes/${space.slug}`}
                      className="block w-full text-center"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        View Class
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No classes yet</h3>
              <p className="text-muted-foreground mt-2">Browse available classes to get started</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <ButtonLink href="/app/classes/browse" className="inline-flex">
                  <Plus className="h-4 w-4 mr-2" />
                  Browse Classes
                </ButtonLink>
                <ButtonLink href="/app/demo" className="inline-flex gap-2">
                  <Sparkles className="h-4 w-4" />
                  Load Sample
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Available Classes */}
      {availableClasses.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Discover More Classes</h2>
            <div className="flex gap-2">
              <ButtonLink href="/app/classes/browse" variant="ghost" size="sm" className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </ButtonLink>
              <ButtonLink href="/app/classes/browse" variant="ghost" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </ButtonLink>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableClasses.slice(0, 6).map((cls) => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                      <CardDescription>{cls.class_code || cls.semester || cls.department}</CardDescription>
                    </div>
                    <Badge variant="outline" className="capitalize">{cls.is_public ? "public" : "private"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cls.instructor && (
                    <p className="text-sm text-muted-foreground">
                      Instructor: {cls.instructor}
                    </p>
                  )}
                  {cls.meeting_schedule && (
                    <p className="text-sm text-muted-foreground">
                      {cls.meeting_schedule}
                    </p>
                  )}
                  <Link href={`/app/classes/${cls.slug}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          {availableClasses.length > 6 && (
            <div className="text-center mt-4">
              <Button variant="outline">
                View All Classes ({availableClasses.length})
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function ClassesPage() {
  return (
    <Suspense fallback={<ListSkeleton count={6} />}>
      <ClassesContent />
    </Suspense>
  );
}