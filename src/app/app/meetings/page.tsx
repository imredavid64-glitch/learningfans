import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-500",
  live: "bg-green-500/10 text-green-500",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default async function MeetingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: organized } = await supabase
    .from("meetings")
    .select("*, spaces(name, slug)")
    .eq("organizer_id", profile.id)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(20);

  const { data: rsvps } = await supabase
    .from("meeting_participants")
    .select("meeting_id, rsvp_status, meetings!inner(*, spaces(name, slug))")
    .eq("user_id", profile.id)
    .gte("meetings.starts_at", now);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-muted-foreground">Upcoming calls and study sessions</p>
        </div>
        <ButtonLink href="/app/meetings/new">Schedule meeting</ButtonLink>
      </div>

      {(!organized?.length && !rsvps?.length) ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No upcoming meetings. Schedule one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {organized?.map((m) => {
            const participant = m as any;
            return (
              <Link key={m.id} href={`/app/meetings/${m.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <Badge className={STATUS_COLORS[m.status]} variant="secondary">{m.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{format(new Date(m.starts_at), "MMM d, yyyy · h:mm a")}</span>
                      {m.spaces && <span>📚 {m.spaces.name}</span>}
                      {m.call_url && <span>🔗 {new URL(m.call_url).hostname}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {(rsvps as any[])?.filter(Boolean).map((r) => {
            const m = r.meetings;
            if (!m) return null;
            return (
              <Link key={m.id} href={`/app/meetings/${m.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[m.status]} variant="secondary">{m.status}</Badge>
                        <Badge variant="outline">{r.rsvp_status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{format(new Date(m.starts_at), "MMM d, yyyy · h:mm a")}</span>
                      {m.spaces && <span>📚 {m.spaces.name}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
