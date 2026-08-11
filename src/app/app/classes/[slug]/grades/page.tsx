import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Award, Plus, BookOpen, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface GradesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClassGradesPage({ params }: GradesPageProps) {
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
  const isInstructor = classData.created_by === profile.id;

  // Get assignments (materials with assignment_details)
  const { data: assignments } = await supabase
    .from("study_materials")
    .select("*")
    .eq("space_id", classData.id)
    .eq("is_hidden", false)
    .contains("metadata", { assignment_details: true })
    .order("created_at", { ascending: false });

  // Get student's grades
  const assignmentIds = assignments?.map(a => a.id) || [];
  
  const gradesMap = new Map();
  if (assignmentIds.length > 0) {
    const { data: grades } = await supabase
      .from("grades")
      .select("*")
      .eq("student_id", profile.id)
      .in("assignment_id", assignmentIds);
    
    grades?.forEach(g => gradesMap.set(g.assignment_id, g));
  }

  // If instructor, get all students' grades
  interface StudentGradeRecord {
    id: string;
    student_id: string;
    assignment_id: string;
    score: number;
    letter_grade: string | null;
    profiles: { id: string; display_name: string; avatar_url: string | null } | { id: string; display_name: string; avatar_url: string | null }[];
  }

  const allStudentGrades: Record<string, Record<string, StudentGradeRecord>> = {};
  if (isInstructor) {
    const { data: allGrades } = await supabase
      .from("grades")
      .select(`
        *,
        profiles!inner(display_name, avatar_url),
        study_materials!inner(id, title, space_id)
      `)
      .eq("study_materials.space_id", classData.id);
    
    allGrades?.forEach(g => {
      const studentId = g.profiles.id;
      if (!allStudentGrades[studentId]) allStudentGrades[studentId] = {};
      allStudentGrades[studentId][g.assignment_id] = g;
    });
  }

  // Get enrolled students for instructor view
  interface EnrolledStudent {
    student_id: string;
    profiles: { id: string; display_name: string; avatar_url: string | null; email: string } | { id: string; display_name: string; avatar_url: string | null; email: string }[];
  }

  let students: EnrolledStudent[] = [];
  if (isInstructor) {
    const { data: enrolledStudents } = await supabase
      .from("class_enrollments")
      .select(`
        student_id,
        profiles!inner(id, display_name, avatar_url, email)
      `)
      .eq("class_id", classData.id)
      .eq("status", "active");
    
    students = enrolledStudents || [];
  }

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
          <h1 className="text-3xl font-bold">Gradebook</h1>
          <p className="text-muted-foreground mt-1">
            {isInstructor ? "Manage student grades and assignments" : "View your grades and progress"}
          </p>
        </div>
        {isInstructor && (
          <div className="flex gap-2">
            <ButtonLink href={`/app/classes/${slug}/assignments/new`} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Assignment
            </ButtonLink>
          </div>
        )}
      </div>

      {isInstructor ? (
        // Instructor Gradebook View
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Class Gradebook
                  </CardTitle>
                  <CardDescription>Click on a grade to edit. Empty cells mean not yet graded.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {assignments?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-2 pr-4 sticky left-0 bg-white z-10 w-48">Student</th>
                        {assignments.map((assignment) => (
                          <th key={assignment.id} className="pb-2 pr-4 text-right w-32">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-medium">{assignment.title.slice(0, 20)}</span>
                              <span className="text-xs text-muted-foreground">
                                {assignment.metadata?.points_possible || 100} pts
                              </span>
                              {assignment.metadata?.due_date && (
                                <span className="text-xs text-orange-600">
                                  Due: {format(new Date(assignment.metadata.due_date), "MMM d")}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="pb-2 pr-4 text-right w-28">Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((enrollment) => {
                        const student = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
                        const studentGrades = allStudentGrades[student.id] || {};
                        
                        let totalPoints = 0;
                        let earnedPoints = 0;
                        let gradedCount = 0;
                        
                        assignments.forEach(a => {
                          const grade = studentGrades[a.id];
                          if (grade) {
                            earnedPoints += grade.score;
                            totalPoints += a.metadata?.points_possible || 100;
                            gradedCount++;
                          } else {
                            totalPoints += a.metadata?.points_possible || 100;
                          }
                        });
                        
                        const average = gradedCount > 0 ? (earnedPoints / totalPoints) * 100 : 0;
                        const letterGrade = average >= 97 ? "A+" : average >= 93 ? "A" : average >= 90 ? "A-" :
                                          average >= 87 ? "B+" : average >= 83 ? "B" : average >= 80 ? "B-" :
                                          average >= 77 ? "C+" : average >= 73 ? "C" : average >= 70 ? "C-" :
                                          average >= 67 ? "D+" : average >= 60 ? "D" : gradedCount > 0 ? "F" : "—";

                        return (
                          <tr key={student.id} className="border-b hover:bg-muted/30">
                            <td className="py-3 pr-4 sticky left-0 bg-white z-10">
                              <Link href={`/app/profile/${student.id}`} className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  {student.avatar_url ? (
                                    <Image src={student.avatar_url} alt="" width={64} height={64} className="h-8 w-8 rounded-full" />
                                  ) : (
                                    <span className="text-primary font-medium">{student.display_name?.[0]?.toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{student.display_name}</p>
                                  <p className="text-xs text-muted-foreground">{student.email}</p>
                                </div>
                              </Link>
                            </td>
                            {assignments.map((assignment) => {
                              const grade = studentGrades[assignment.id];
                              return (
                                <td key={assignment.id} className="py-3 pr-4 text-right">
                                  {grade ? (
                                    <Link 
                                      href={`/app/classes/${slug}/grades/${student.id}/${assignment.id}`}
                                      className="inline-block"
                                    >
                                      <span className={`font-mono font-medium ${grade.score >= 90 ? "text-green-600" : grade.score >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                                        {grade.score.toFixed(1)}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-1">
                                        /{assignment.metadata?.points_possible || 100}
                                      </span>
                                    </Link>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-3 pr-4 text-right font-medium">
                              {gradedCount > 0 ? (
                                <>
                                  <span className={`${average >= 90 ? "text-green-600" : average >= 70 ? "text-yellow-600" : average >= 60 ? "text-orange-600" : "text-red-600"}`}>
                                    {average.toFixed(1)}%
                                  </span>
                                  <span className="text-sm text-muted-foreground ml-2">({letterGrade})</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">Not graded</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Award className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No assignments yet</h3>
                  <p className="text-muted-foreground mt-2">Create assignments to start tracking grades</p>
                  <ButtonLink href={`/app/classes/${slug}/assignments/new`} className="mt-4 inline-flex gap-2">
                    <Plus className="h-4 w-4" />
                    Create Assignment
                  </ButtonLink>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : isEnrolled ? (
        // Student Grade View
        <div className="space-y-6">
          {/* Overall Stats */}
          {(() => {
            const assignmentList = assignments || [];
            const gradedAssignments = assignmentList.filter(a => gradesMap.has(a.id));
            const average = gradedAssignments.length > 0
              ? (gradedAssignments.reduce((sum, a) => sum + (gradesMap.get(a.id)?.score || 0), 0) / gradedAssignments.length).toFixed(1)
              : "—";
            const completedCount = gradedAssignments.length;
            const totalCount = assignmentList.length;
            const letterGrade = (() => {
              const avg = gradedAssignments.length > 0
                ? gradedAssignments.reduce((sum, a) => sum + (gradesMap.get(a.id)?.score || 0), 0) / gradedAssignments.length
                : 0;
              return avg >= 97 ? "A+" : avg >= 93 ? "A" : avg >= 90 ? "A-" :
                     avg >= 87 ? "B+" : avg >= 83 ? "B" : avg >= 80 ? "B-" :
                     avg >= 77 ? "C+" : avg >= 73 ? "C" : avg >= 70 ? "C-" :
                     avg >= 67 ? "D+" : avg >= 60 ? "D" : "F";
            })();
            
            return (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{average}%</p>
                      <p className="text-sm text-muted-foreground">Current Average</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-green/10 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-green" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{completedCount}</p>
                      <p className="text-sm text-muted-foreground">
                        Graded Assignments
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-blue/10 rounded-lg">
                      <BookOpen className="h-6 w-6 text-blue" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {completedCount} / {totalCount}
                      </p>
                      <p className="text-sm text-muted-foreground">Completed / Total</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="p-3 bg-purple/10 rounded-lg">
                      <Award className="h-6 w-6 text-purple" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{letterGrade}</p>
                      <p className="text-sm text-muted-foreground">Letter Grade</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Assignments List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignments?.length ? (
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const grade = gradesMap.get(assignment.id);
                    const isGraded = !!grade;
                    const dueDate = assignment.metadata?.due_date;
                    const pointsPossible = assignment.metadata?.points_possible || 100;
                    
                    return (
                      <div 
                        key={assignment.id} 
                        className={`p-4 border rounded-lg ${isGraded ? "bg-green-50 border-green-200" : dueDate && new Date(dueDate) < new Date() ? "bg-red-50 border-red-200" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-medium">{assignment.title}</h3>
                              <Badge variant="secondary" className="text-xs">Assignment</Badge>
                              {isGraded && (
                                <Badge variant="default" className="text-xs">
                                  Graded: {grade.score.toFixed(1)}%
                                </Badge>
                              )}
                              {!isGraded && dueDate && new Date(dueDate) < new Date() && (
                                <Badge variant="destructive" className="text-xs">
                                  Overdue
                                </Badge>
                              )}
                              {!isGraded && dueDate && new Date(dueDate) >= new Date() && (
                                <Badge variant="outline" className="text-xs">
                                  Due: {format(new Date(dueDate), "MMM d, yyyy")}
                                </Badge>
                              )}
                            </div>
                            {assignment.description && (
                              <p className="text-sm text-muted-foreground mb-2">{assignment.description}</p>
                            )}
                            {assignment.metadata?.instructions && (
                              <p className="text-xs text-muted-foreground">
                                {assignment.metadata.instructions}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <p className={`font-mono font-medium text-lg ${isGraded ? "text-green-600" : "text-muted-foreground"}`}>
                                {isGraded ? `${grade.score.toFixed(1)}%` : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">/ {pointsPossible} pts</p>
                            </div>
                            {isGraded && grade.letter_grade && (
                              <Badge variant="secondary" className="text-sm">
                                {grade.letter_grade}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isGraded && grade.feedback && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              <strong>Feedback:</strong> {grade.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Award className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No assignments yet</h3>
                  <p className="text-muted-foreground mt-2">Your instructor hasn&apos;t posted any assignments for this class</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Not enrolled
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Not enrolled in this class</h3>
            <p className="text-muted-foreground mt-2">Enroll to view your grades and assignments</p>
            <ButtonLink href={`/app/classes/${slug}/enroll`} className="mt-4 inline-flex gap-2">
              <Plus className="h-4 w-4" />
              Enroll Now
            </ButtonLink>
          </CardContent>
        </Card>
      )}
    </div>
  );
}