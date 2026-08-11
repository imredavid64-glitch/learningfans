import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  BookOpen, 
  Calendar, 
  MessageSquare, 
  FileText,
  Award,
  Plus,
  ArrowRight,
  Lock,
  Unlock,
  GraduationCap,
  Clock,
  MoreVertical
} from "lucide-react";
import { format } from "date-fns";

interface ClassDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const supabase = await createClient();

  // Get class details
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

  // Check if instructor
  const isInstructor = classData.created_by === profile.id;
  const isEnrolled = !!enrollment;

  // Get class stats
  const { count: studentCount } = await supabase
    .from("class_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classData.id)
    .eq("status", "active");

  const { count: threadCount } = await supabase
    .from("threads")
    .select("*", { count: "exact", head: true })
    .eq("space_id", classData.id)
    .eq("is_hidden", false);

  const { count: materialCount } = await supabase
    .from("study_materials")
    .select("*", { count: "exact", head: true })
    .eq("space_id", classData.id)
    .eq("is_hidden", false);

  // Get recent threads
  const { data: recentThreads } = await supabase
    .from("threads")
    .select(`
      id,
      title,
      body,
      created_at,
      author_id,
      is_pinned,
      is_locked,
      profiles!inner(display_name, avatar_url)
    `)
    .eq("space_id", classData.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(5);

  // Get upcoming assignments
  const { data: assignments } = await supabase
    .from("study_materials")
    .select("*")
    .eq("space_id", classData.id)
    .eq("is_hidden", false)
    .contains("metadata", { assignment_details: true })
    .order("created_at", { ascending: false })
    .limit(5);

  // Get upcoming events
  const { data: events } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("space_id", classData.id)
    .eq("visibility", "space")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);

  // Get students (if instructor)
  let students: Array<{
    id: string;
    student_id: string;
    status: string;
    enrolled_at: string;
    profiles:
      | {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          email: string | null;
          major: string | null;
          gpa: number | null;
        }
      | Array<{
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          email: string | null;
          major: string | null;
          gpa: number | null;
        }>;
  }> = [];
  if (isInstructor) {
    const { data: enrolledStudents } = await supabase
      .from("class_enrollments")
      .select(`
        id,
        student_id,
        status,
        enrolled_at,
        profiles!inner(id, display_name, avatar_url, email, major, gpa)
      `)
      .eq("class_id", classData.id)
      .eq("status", "active")
      .limit(30);
    students = enrolledStudents || [];
  }

  return (
    <div className="space-y-8">
      {/* Class Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              {classData.is_public ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
              {classData.is_public ? "Public" : "Private"}
            </Badge>
            {isInstructor && <Badge variant="default" className="text-xs">Instructor</Badge>}
            {isEnrolled && !isInstructor && <Badge variant="outline" className="text-xs">Enrolled</Badge>}
            {!isEnrolled && !isInstructor && <Badge variant="secondary" className="text-xs">Not Enrolled</Badge>}
          </div>
          <h1 className="text-3xl font-bold">{classData.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            {classData.class_code && <span className="font-mono bg-muted px-2 py-0.5 rounded">{classData.class_code}</span>}
            {classData.semester && <span>{classData.semester}</span>}
            {classData.quarter && <span>{classData.quarter}</span>}
            {classData.department && <span>{classData.department}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {!isEnrolled && !isInstructor && (
            <Link href={`/app/classes/${slug}/enroll`}>
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                Enroll
              </Button>
            </Link>
          )}
          <Link href={`/app/classes/${slug}/threads`}>
            <Button variant="outline" size="lg" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Discussions
            </Button>
          </Link>
          <Link href={`/app/classes/${slug}/materials`}>
            <Button variant="outline" size="lg" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Materials
            </Button>
          </Link>
          <Link href={`/app/classes/${slug}/grades`}>
            <Button variant="outline" size="lg" className="gap-2">
              <Award className="h-4 w-4" />
              Grades
            </Button>
          </Link>
          {isInstructor && (
            <Link href={`/app/classes/${slug}/students`}>
              <Button variant="outline" size="lg" className="gap-2">
                <Users className="h-4 w-4" />
                Students ({studentCount || 0})
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentCount || 0}</p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-blue/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{threadCount || 0}</p>
              <p className="text-sm text-muted-foreground">Discussions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-green/10 rounded-lg">
              <BookOpen className="h-6 w-6 text-green" />
            </div>
            <div>
              <p className="text-2xl font-bold">{materialCount || 0}</p>
              <p className="text-sm text-muted-foreground">Materials</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-purple/10 rounded-lg">
              <Clock className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">{assignments?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Assignments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="discussions">Discussions</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          {isInstructor && <TabsTrigger value="students">Students</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Discussions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Recent Discussions
                </CardTitle>
                <Link href={`/app/classes/${slug}/threads`}>
                  <ButtonLink href={`/app/classes/${slug}/threads`} variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </ButtonLink>
                </Link>
              </CardHeader>
              <CardContent>
                {recentThreads?.length ? (
                  <div className="space-y-3">
                    {recentThreads.map((thread) => {
                      const author = Array.isArray(thread.profiles) ? thread.profiles[0] : thread.profiles;
                      return (
                        <Link 
                          key={thread.id} 
                          href={`/app/classes/${slug}/threads/${thread.id}`}
                          className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{thread.title}</p>
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {thread.body?.slice(0, 100)}...
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{author?.display_name || "Unknown"}</span>
                                <span>•</span>
                                <span>{format(new Date(thread.created_at), "MMM d, yyyy")}</span>
                                {thread.is_pinned && (
                                  <Badge variant="secondary" className="text-xs">
                                    Pinned
                                  </Badge>
                                )}
                                {thread.is_locked && (
                                  <Badge variant="secondary" className="text-xs">
                                    Locked
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No discussions yet. Be the first to start one!
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Assignments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Upcoming Assignments
                </CardTitle>
                <Link href={`/app/classes/${slug}/grades`}>
                  <ButtonLink href={`/app/classes/${slug}/grades`} variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </ButtonLink>
                </Link>
              </CardHeader>
              <CardContent>
                {assignments?.length ? (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <div 
                        key={assignment.id} 
                        className="p-3 rounded-lg border"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{assignment.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {assignment.metadata?.instructions || "No description"}
                            </p>
                          </div>
                          {assignment.metadata?.due_date && (
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                Due: {format(new Date(assignment.metadata.due_date), "MMM d, yyyy")}
                              </p>
                              {assignment.metadata?.points_possible && (
                                <p className="text-xs text-muted-foreground">
                                  {assignment.metadata.points_possible} points
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No upcoming assignments
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events */}
          {events?.length && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming Events
                </CardTitle>
                <Link href={`/app/classes/${slug}/schedule`}>
                  <ButtonLink href={`/app/classes/${slug}/schedule`} variant="ghost" size="sm">
                    View Schedule
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </ButtonLink>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events.map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-center gap-4 p-3 rounded-lg border"
                    >
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.starts_at), "MMM d, yyyy 'at' h:mm a")}
                          {event.ends_at && ` - ${format(new Date(event.ends_at), "h:mm a")}`}
                          {event.room && ` • Room ${event.room}`}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {event.visibility === "space" ? "Class" : "Personal"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks for this class</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href={`/app/classes/${slug}/threads/new`} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="font-medium">Start Discussion</p>
                <p className="text-sm text-muted-foreground">Ask a question or share notes</p>
              </Link>
              <Link href={`/app/classes/${slug}/materials/new`} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                <BookOpen className="h-8 w-8 mx-auto text-blue mb-2" />
                <p className="font-medium">Add Material</p>
                <p className="text-sm text-muted-foreground">Share notes, files, or links</p>
              </Link>
              <Link href={`/app/classes/${slug}/schedule/new`} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                <Calendar className="h-8 w-8 mx-auto text-green mb-2" />
                <p className="font-medium">Create Event</p>
                <p className="text-sm text-muted-foreground">Schedule study sessions</p>
              </Link>
              {isInstructor && (
                <Link href={`/app/classes/${slug}/assignments/new`} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                  <FileText className="h-8 w-8 mx-auto text-purple mb-2" />
                  <p className="font-medium">Create Assignment</p>
                  <p className="text-sm text-muted-foreground">Post homework or projects</p>
                </Link>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discussions Tab */}
        <TabsContent value="discussions">
          <Link href={`/app/classes/${slug}/threads/new`} className="mb-4 inline-flex">
            <ButtonLink href={`/app/classes/${slug}/threads/new`} className="gap-2">
              <Plus className="h-4 w-4" />
              New Discussion
            </ButtonLink>
          </Link>
          <div className="space-y-3">
            {recentThreads?.length ? (
              recentThreads.map((thread) => {
                const author = Array.isArray(thread.profiles) ? thread.profiles[0] : thread.profiles;
                return (
                  <Card key={thread.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <Link href={`/app/classes/${slug}/threads/${thread.id}`}>
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{thread.title}</h3>
                              {thread.is_pinned && <Badge variant="secondary" className="text-xs">Pinned</Badge>}
                              {thread.is_locked && <Badge variant="secondary" className="text-xs">Locked</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{thread.body?.slice(0, 150)}...</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>{author?.display_name || "Unknown"}</span>
                              <span>•</span>
                              <span>{format(new Date(thread.created_at), "MMM d, yyyy")}</span>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No discussions yet</h3>
                  <p className="text-muted-foreground mt-2">Start the first discussion in this class!</p>
                  <Link href={`/app/classes/${slug}/threads/new`} className="mt-4 inline-flex">
                    <ButtonLink href={`/app/classes/${slug}/threads/new`} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Discussion
                    </ButtonLink>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials">
          <Link href={`/app/classes/${slug}/materials/new`} className="mb-4 inline-flex">
            <ButtonLink href={`/app/classes/${slug}/materials/new`} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Material
            </ButtonLink>
          </Link>
          <p className="text-center text-muted-foreground py-12">
            Browse and share study materials, notes, files, and flashcards
          </p>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments">
          {isInstructor ? (
            <Link href={`/app/classes/${slug}/assignments/new`} className="mb-4 inline-flex">
              <ButtonLink href={`/app/classes/${slug}/assignments/new`} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Assignment
              </ButtonLink>
            </Link>
          ) : null}
          <div className="space-y-3">
            {assignments?.length ? (
              assignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{assignment.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {assignment.metadata?.instructions || "No description"}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {assignment.metadata?.due_date && (
                            <span>Due: {format(new Date(assignment.metadata.due_date), "MMM d, yyyy")}</span>
                          )}
                          {assignment.metadata?.points_possible && (
                            <span>{assignment.metadata.points_possible} points</span>
                          )}
                        </div>
                      </div>
                      <Link href={`/app/classes/${slug}/grades`}>
                        <ButtonLink href={`/app/classes/${slug}/grades`} variant="ghost" size="sm">
                          View
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </ButtonLink>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No assignments yet</h3>
                  <p className="text-muted-foreground mt-2">
                    {isInstructor ? "Create your first assignment to get started" : "Check back for new assignments from your instructor"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Link href={`/app/classes/${slug}/schedule`} className="mb-4 inline-flex">
            <ButtonLink href={`/app/classes/${slug}/schedule`} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </ButtonLink>
          </Link>
          <div className="space-y-3">
            {events?.length ? (
              events.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{event.title}</h3>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {event.visibility === "space" ? "Class Event" : "Personal"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.starts_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                          {event.ends_at && ` - ${format(new Date(event.ends_at), "h:mm a")}`}
                          {event.room && ` • Room ${event.room}`}
                        </p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                        )}
                      </div>
              <Link href={`/app/classes/${slug}/schedule`}>
                <ButtonLink href={`/app/classes/${slug}/schedule`} variant="ghost" size="sm">View</ButtonLink>
              </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No upcoming events</h3>
                  <p className="text-muted-foreground mt-2">Schedule study sessions, office hours, or exams</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Students Tab (Instructor Only) */}
        {isInstructor && (
          <TabsContent value="students">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Enrolled Students ({students.length})</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Export Roster</Button>
                  <Button variant="outline" size="sm">Email All</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-2 pr-4">Student</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Major</th>
                      <th className="pb-2 pr-4">GPA</th>
                      <th className="pb-2 pr-4">Enrolled</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((enrollment) => {
                      const student = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
                      return (
                        <tr key={enrollment.id} className="border-b">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              {student?.avatar_url ? (
                                <Image src={student.avatar_url} alt="" width={64} height={64} className="h-8 w-8 rounded-full" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <GraduationCap className="h-4 w-4 text-primary" />
                                </div>
                              )}
                              <span className="font-medium">{student?.display_name || "Unknown"}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm">{student?.email || "-"}</td>
                          <td className="py-3 pr-4 text-sm">{student?.major || "-"}</td>
                          <td className="py-3 pr-4 text-sm">{student?.gpa ? student.gpa.toFixed(2) : "-"}</td>
                          <td className="py-3 pr-4 text-sm">
                            {format(new Date(enrollment.enrolled_at), "MMM d, yyyy")}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <Link href={`/app/classes/${slug}/grades`}>
                                <ButtonLink href={`/app/classes/${slug}/grades`} variant="ghost" size="icon">
                                  <Award className="h-4 w-4" />
                                </ButtonLink>
                              </Link>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {students.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No students enrolled yet</h3>
                    <p className="text-muted-foreground mt-2">Students will appear here once they enroll</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}