import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { trophiesFor, nextTrophy } from "@/lib/trophies";
import { GraduationCap, Mail, Award, Users, Flame, Star, PencilLine, Trophy } from "lucide-react";
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

  const [enrollments, spaces, stats] = await Promise.all([
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
    supabase.rpc("get_public_stats", { p_user_id: id }),
  ]);

  const isMe = me.id === id;
  const statsRow = Array.isArray(stats.data) ? stats.data[0] : null;

  const earned = trophiesFor({
    total_xp: Number(statsRow?.total_xp ?? 0),
    current_streak: Number(statsRow?.current_streak ?? 0),
    longest_streak: Number(statsRow?.longest_streak ?? 0),
    profileComplete: Boolean(profile.bio || profile.major || profile.avatar_url || (profile.interests?.length ?? 0) > 0),
    spaceCount: spaces?.data?.length ?? 0,
  });
  const nudge = nextTrophy({
    total_xp: Number(statsRow?.total_xp ?? 0),
    current_streak: Number(statsRow?.current_streak ?? 0),
    longest_streak: Number(statsRow?.longest_streak ?? 0),
    profileComplete: false,
    spaceCount: spaces?.data?.length ?? 0,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-border overflow-hidden">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="" width={160} height={160} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <GraduationCap className="h-9 w-9 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={profile.role === "admin" ? "default" : profile.role === "moderator" ? "secondary" : "outline"}>
              {profile.role}
            </Badge>
            {profile.major && <span className="text-sm text-muted-foreground">{profile.major}</span>}
            {typeof profile.gpa === "number" && profile.gpa > 0 && (
              <span className="text-sm text-muted-foreground">GPA {profile.gpa.toFixed(2)}</span>
            )}
            {isMe && (
              <ButtonLink href="/app/settings" variant="outline" size="sm" className="gap-1">
                <PencilLine className="h-3 w-3" />
                Edit profile
              </ButtonLink>
            )}
          </div>
          {profile.bio && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
          )}
          {profile.interests && profile.interests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.interests.map((interest: string) => (
                <span key={interest} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  {interest}
                </span>
              ))}
            </div>
          )}
          {profile.parent_email && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Mail className="h-3.5 w-3.5" /> {profile.parent_email}
            </p>
          )}
        </div>
      </div>

      {statsRow && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-4 text-center">
            <Star className="mx-auto mb-1 h-5 w-5 text-amber-500" />
            <p className="text-2xl font-bold">{statsRow.total_xp ?? 0}</p>
            <p className="text-xs text-muted-foreground">XP</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <GraduationCap className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="text-2xl font-bold">{statsRow.level ?? 1}</p>
            <p className="text-xs text-muted-foreground">Level</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <Flame className="mx-auto mb-1 h-5 w-5 text-orange-500" />
            <p className="text-2xl font-bold">{statsRow.current_streak ?? 0}</p>
            <p className="text-xs text-muted-foreground">day streak</p>
          </div>
        </div>
      )}

      {earned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Karma Trophies
              <Badge variant="secondary" className="ml-auto">{earned.length} earned</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {earned.map((t) => (
                <span
                  key={t.id}
                  title={t.description}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
                >
                  <span>{t.emoji}</span>
                  <span className="font-medium">{t.label}</span>
                </span>
              ))}
            </div>
            {nudge && (
              <p className="mt-3 text-xs text-muted-foreground">
                Next up: {nudge.emoji} {nudge.label} — {nudge.description}
              </p>
            )}
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
