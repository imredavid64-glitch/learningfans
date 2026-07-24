import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, Award, BookOpen, Users, TrendingUp, AlertCircle, Plus } from "lucide-react";

export default async function GradesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  // Get student's enrolled classes
  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(`
      class_id,
      status,
      enrolled_at,
      spaces (id, name, slug, class_code, semester, instructor)
    `)
    .eq("student_id", profile.id)
    .eq("status", "active");

  // Get grades for each class
  const gradesData = await Promise.all(
    (enrollments || []).map(async (enrollment) => {
      const classId = enrollment.class_id;
      const classData = (Array.isArray(enrollment.spaces) ? enrollment.spaces[0] : enrollment.spaces);
      
      // Get assignments for this class
      const { data: assignments } = await supabase
        .from("study_materials")
        .select("id, title, type, description, metadata")
        .eq("space_id", classId)
        .eq("type", "flashcard_set");

      if (!assignments?.length) {
        return { class: classData, grades: [], average: 0 };
      }

      // Get grades for these assignments
      const assignmentIds = assignments.map(a => a.id);
      const { data: grades } = await supabase
        .from("grades")
        .select("*")
        .eq("student_id", profile.id)
        .in("assignment_id", assignmentIds);

      const gradesMap = new Map((grades || []).map(g => [g.assignment_id, g]));
      
      const gradesWithDetails = assignments.map(a => ({
        ...a,
        grade: gradesMap.get(a.id) || null,
        dueDate: a.metadata?.due_date ? new Date(a.metadata.due_date) : null,
        pointsPossible: a.metadata?.points_possible || 100
      }));

      // Calculate overall average
      const gradedAssignments = gradesWithDetails.filter(g => g.grade);
      const average = gradedAssignments.length > 0
        ? gradedAssignments.reduce((sum, g) => sum + (g.grade?.score || 0), 0) / gradedAssignments.length
        : 0;

      return {
        class: classData,
        grades: gradesWithDetails,
        average,
        gradedCount: gradedAssignments.length,
        totalCount: assignments.length
      };
    })
  );

  return (
    <div className="space-y-8">
      <div className="sm:flex sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Grades</h1>
          <p className="text-muted-foreground">
            Track your academic progress across all classes
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/grades/export">
            <Button variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {gradesData.length > 0 
                ? (gradesData.reduce((sum, c) => sum + c.average, 0) / gradesData.length).toFixed(1)
                : "—"
              }%
            </div>
            <p className="text-xs text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{gradesData.length}</div>
            <p className="text-xs text-muted-foreground">Active enrollments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments Completed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {gradesData.reduce((sum, c) => sum + (c.gradedCount || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              out of {gradesData.reduce((sum, c) => sum + (c.totalCount || 0), 0)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Grades</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {gradesData.reduce((sum, c) => sum + ((c.totalCount || 0) - (c.gradedCount || 0)), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting feedback</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Class Grades */}
      <div className="space-y-6">
        {gradesData.map(({ class: classData, grades, average, gradedCount, totalCount }) => (
          <Card key={classData.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{classData.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                      {classData.class_code && <Badge variant="secondary">{classData.class_code}</Badge>}
                      {classData.semester && <Badge variant="outline">{classData.semester}</Badge>}
                      {classData.instructor && <Badge variant="outline">Prof. {classData.instructor}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{average.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Class Average</p>
                  </div>
                  <Link href={`/app/classes/${classData.slug}/grades`}>
                    <Button variant="outline" size="sm" className="gap-1">
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="divide-y">
                {grades.map(({ title, grade, dueDate, pointsPossible, metadata }) => (
                  <div key={title} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-medium truncate">{title}</h3>
                        {grade ? (
                          <>
                            <Badge variant={grade.score >= 90 ? "default" : grade.score >= 70 ? "secondary" : "destructive"}>
                              {grade.score.toFixed(1)}%
                            </Badge>
                            {grade.letter_grade && (
                              <Badge variant="outline">{grade.letter_grade}</Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pending
                          </Badge>
                        )}
                        {dueDate && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <span className="w-4 h-4" />
                            Due: {format(dueDate, "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {metadata?.instructions && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {metadata.instructions}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 sm:mt-0 sm:ml-4">
                      <span className="text-sm text-muted-foreground">
                        {grade 
                          ? `${grade.score.toFixed(1)}/${pointsPossible}` 
                          : "Not graded"
                        }
                      </span>
                      {grade && (
                        <Link href={`/app/assignments/${grade.id}/feedback`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            View Feedback
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                {grades.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No assignments yet for this class</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {gradesData.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg mb-2">No classes enrolled yet</p>
              <p>Enroll in classes to see your grades here</p>
              <Link href="/app/classes">
                <Button className="mt-4 inline-flex gap-2">
                  <Plus className="h-4 w-4" />
                  Browse Classes
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}