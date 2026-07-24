import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  Award, 
  BookOpen, 
  Download, 
  Mail, 
  MoreVertical,
  Search,
  Filter,
  Plus
} from "lucide-react";
import { format } from "date-fns";

interface StudentsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClassStudentsPage({ params }: StudentsPageProps) {
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

  // Check if instructor
  const isInstructor = classData.created_by === profile.id;
  if (!isInstructor) {
    return notFound(); // Only instructors can view student list
  }

  // Get enrolled students with grades summary
  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(`
      id,
      student_id,
      status,
      enrolled_at,
      profiles!inner(id, display_name, avatar_url, email, major, gpa, credits_completed)
    `)
    .eq("class_id", classData.id)
    .eq("status", "active");

  // Get assignments for this class
  const { data: assignments } = await supabase
    .from("study_materials")
    .select("id, title, metadata")
    .eq("space_id", classData.id)
    .eq("type", "flashcard_set")
    .contains("metadata", { assignment_details: true });

  const assignmentIds = assignments?.map(a => a.id) || [];

  // Get all grades for these assignments
  let gradesMap = new Map();
  if (assignmentIds.length > 0) {
    const { data: grades } = await supabase
      .from("grades")
      .select("student_id, assignment_id, score, letter_grade")
      .in("assignment_id", assignmentIds);
    
    grades?.forEach(g => {
      const key = `${g.student_id}-${g.assignment_id}`;
      gradesMap.set(key, g);
    });
  }

  // Calculate stats for each student
  const studentsWithStats = (enrollments || []).map(enrollment => {
    const student = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const studentGrades = assignmentIds.map(aid => gradesMap.get(`${student.id}-${aid}`)).filter(Boolean);
    
    const gradedCount = studentGrades.length;
    const totalAssignments = assignmentIds.length;
    const average = studentGrades.length > 0 
      ? studentGrades.reduce((sum, g) => sum + (g.score || 0), 0) / studentGrades.length 
      : 0;
    
    return {
      ...enrollment,
      student,
      stats: {
        gradedCount,
        totalAssignments,
        average: Math.round(average * 10) / 10,
        letterGrade: average >= 90 ? 'A' : average >= 80 ? 'B' : average >= 70 ? 'C' : average >= 60 ? 'D' : 'F'
      }
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href={`/app/classes/${slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {classData.name}
          </Link>
          <h1 className="text-3xl font-bold">Class Roster</h1>
          <p className="text-muted-foreground mt-1">Manage enrolled students and track progress</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Roster
          </Button>
          <Button variant="outline" className="gap-2">
            <Mail className="h-4 w-4" />
            Email All
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{studentsWithStats.length}</p>
                <p className="text-sm text-muted-foreground">Enrolled Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {assignments?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {studentsWithStats.reduce((sum, s) => sum + s.stats.gradedCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Award className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {studentsWithStats.length > 0 
                    ? Math.round(studentsWithStats.reduce((sum, s) => sum + s.stats.average, 0) / studentsWithStats.length * 10) / 10
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Class Average</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Students ({studentsWithStats.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search students..."
                className="pl-10 pr-4 py-2 border border-input bg-background rounded-md w-64 sm:w-80 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button variant="outline" className="gap-1">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {studentsWithStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Major</th>
                    <th className="pb-2 pr-4">GPA</th>
                    <th className="pb-2 pr-4">Enrolled</th>
                    <th className="pb-2 pr-4 text-center">Progress</th>
                    <th className="pb-2 pr-4 text-center">Avg Score</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsWithStats.map(({ id, student, enrolled_at, stats }) => (
                    <tr key={id} className="border-b hover:bg-muted/30">
                      <td className="py-3 pr-4">
                        <Link href={`/app/profile/${student.id}`} className="flex items-center gap-3 hover:text-primary">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student?.avatar_url} alt={student?.display_name} />
                            <AvatarFallback>{student?.display_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{student?.display_name}</span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-sm">{student?.email || "-"}</td>
                      <td className="py-3 pr-4 text-sm">{student?.major || "-"}</td>
                      <td className="py-3 pr-4 text-sm">
                        {student?.gpa ? student.gpa.toFixed(2) : "-"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {format(new Date(enrolled_at), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-sm font-medium">
                            {stats.gradedCount}/{stats.totalAssignments}
                          </span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: stats.totalAssignments > 0 ? `${(stats.gradedCount / stats.totalAssignments) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-bold ${stats.average >= 90 ? 'text-green-600' : stats.average >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {stats.average > 0 ? `${stats.average}%` : '—'}
                          </span>
                          <Badge 
                            variant={stats.average >= 90 ? 'default' : stats.average >= 80 ? 'secondary' : stats.average >= 70 ? 'outline' : 'destructive'}
                            className="text-xs mt-1"
                          >
                            {stats.letterGrade}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/app/classes/${slug}/students/${student.id}/grades`}>
                            <Button variant="ghost" size="icon" aria-label="View Grades">
                              <Award className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" aria-label="Message Student">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="More Options">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No students enrolled yet</h3>
              <p className="text-muted-foreground mt-2">Students will appear here once they enroll in this class</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}