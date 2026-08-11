import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Mail, Award, Users } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const me = await getCurrentProfile();
  if (!me) redirect("/login");

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) return notFound();

  const [enrollments, spaces] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("spaces(id, name, slug, instructor, class_code, semester)")
      .eq("student_id", id)
      .eq("status", "active")
      .limit(10),
    supabase
      .from("space_members")
      .select("spaces(id, name, slug, is_public)")
      .eq("user_id", id)
      .limit(10),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="" width={128} height={128} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <GraduationCap className="h-8 w-8 text-primary" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={profile.role === "admin" ? "default" : profile.role === "moderator" ? "secondary" : "outline"}>
              {profile.role}
            </Badge>
            {profile.major && <span className="text-sm text-muted-foreground">{profile.major}</span>}
            {typeof profile.gpa === "number" && profile.gpa > 0 && (
              <span className="text-sm text-muted-foreground">GPA {profile.gpa.toFixed(2)}</span>
            )}
          </div>
          {profile.email && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Mail className="h-3.5 w-3.5" /> {profile.email}
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Enrolled Classes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments?.data?.length ? (
            <div className="space-y-2">
              {enrollments.data.map((e) => {
                const cls = Array.isArray(e.spaces) ? e.spaces[0] : e.spaces;
                if (!cls) return null;
                return (
                  <Link
                    key={cls.id}
                    href={`/app/classes/${cls.slug}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[cls.class_code, cls.semester, cls.instructor].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">View →</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not enrolled in any classes</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Study Spaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          {spaces?.data?.length ? (
            <div className="space-y-2">
              {spaces.data.map((s) => {
                const space = Array.isArray(s.spaces) ? s.spaces[0] : s.spaces;
                if (!space) return null;
                return (
                  <Link
                    key={space.id}
                    href={`/app/spaces/${space.slug}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{space.name}</p>
                      <p className="text-xs text-muted-foreground">{space.is_public ? "Public" : "Private"} space</p>
                    </div>
                    <span className="text-sm text-muted-foreground">View →</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No study spaces</p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Member since {profile.created_at ? format(new Date(profile.created_at), "MMMM yyyy") : "—"}
      </p>
    </div>
  );
}
