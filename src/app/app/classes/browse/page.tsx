import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getAvailableClasses, getUserEnrollments, enrollInClass } from "@/actions/classes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, BookOpen, Users, Calendar, Plus, CheckCircle2, Lock, Unlock } from "lucide-react";

export default async function BrowseClassesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  
  const [classes, enrollments] = await Promise.all([
    getAvailableClasses(),
    getUserEnrollments(profile.id),
  ]);

  const { data: spacePasswords } = await supabase
    .from("spaces")
    .select("id, join_password_hash");

  const enrolledIds = new Set(enrollments.map(e => e.class_id));
  const passwordMap = new Map((spacePasswords || []).map((c) => [c.id, c.join_password_hash]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Browse Classes</h1>
        <p className="text-muted-foreground mt-1">
          Discover and enroll in classes that match your interests
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search classes..."
            className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No classes available</h3>
            <p className="text-muted-foreground mt-2">Check back later for new classes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const isEnrolled = enrolledIds.has(cls.id);
            const hasPassword = !!passwordMap.get(cls.id);
            return (
              <Card key={cls.id} className="hover:shadow-md transition-shadow flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {cls.name}
                        {hasPassword ? (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Password protected" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Open enrollment" />
                        )}
                        <Badge variant={cls.is_public ? "default" : "secondary"} className="text-xs">
                          {cls.is_public ? "Public" : "Private"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {cls.class_code || cls.semester || cls.department || "General"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    {cls.instructor && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Prof. {cls.instructor}
                      </p>
                    )}
                    {cls.semester && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {cls.semester}
                      </p>
                    )}
                    {cls.meeting_schedule && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {cls.meeting_schedule}
                      </p>
                    )}
                    {cls.room && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Room: {cls.room}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <Link href={`/app/classes/${cls.slug}`}>
                    <Button variant="outline" size="sm" className="w-full mb-2">
                      View Details
                    </Button>
                  </Link>
                  
                  <form action={enrollInClass.bind(null, cls.id)} className="space-y-2">
                    {hasPassword && (
                      <input
                        type="password"
                        name="joinPassword"
                        placeholder="Class password"
                        required
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                    <Button 
                      type="submit" 
                      disabled={isEnrolled}
                      className="w-full"
                      variant={isEnrolled ? "secondary" : "default"}
                    >
                      {isEnrolled ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Enrolled
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Enroll
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}