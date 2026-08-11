import Link from "next/link";
import { Suspense } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Video, Sparkles } from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-500",
  live: "bg-green-500/10 text-green-500",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

interface MeetingRow {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  call_url: string | null;
  spaces?: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

interface RsvpRow {
  meeting_id: string;
  rsvp_status: string;
  meetings: MeetingRow[] | null;
}

function getSpaceName(spaces: MeetingRow["spaces"]): string | undefined {
  if (!spaces) return undefined;
  const s = Array.isArray(spaces) ? spaces[0] : spaces;
  return s?.name;
}

function getMeeting(r: RsvpRow): MeetingRow | null {
  const list = Array.isArray(r.meetings) ? r.meetings : [r.meetings].filter(Boolean);
  return list[0] ?? null;
}

async function MeetingsContent() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: organized } = await supabase
    .from("meetings")
    .select("*", { head: true, count: "exact" })
    .eq("organizer_id", profile.id)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(20);

  const { data: rsvps } = await supabase
    .from("meeting_participants")
    .select("meeting_id, rsvp_status, meetings!inner(*, spaces(name, slug))", { head: true, count: "exact" })
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
          <CardContent className="py-12 text-center">
            <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No upcoming meetings</h3>
            <p className="text-muted-foreground text-sm mb-4">Schedule one to get started</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <ButtonLink href="/app/meetings/new">Schedule meeting</ButtonLink>
              <ButtonLink href="/demo" className="gap-2">
                <Sparkles className="h-4 w-4" />
                See Demo Meetings
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {organized?.map((m) => {
            const spaceName = getSpaceName(m.spaces);
            return (
              <Link key={m.id} href={`/app/meetings/${m.id}`} className="block">
                <Card className={`transition-colors hover:bg-accent/50 ${m.status === "live" ? "border-green-500/40 bg-green-500/5" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        {m.status === "live" && (
                          <Badge className="gap-1 bg-green-500/15 text-green-600 dark:text-green-400">
                            <Video className="h-3 w-3 animate-pulse" /> LIVE
                          </Badge>
                        )}
                        <Badge className={STATUS_COLORS[m.status]} variant="secondary">{m.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{format(new Date(m.starts_at), "MMM d, yyyy · h:mm a")}</span>
                      {spaceName && <span>📚 {spaceName}</span>}
                      {m.call_url && <span>🔗 {new URL(m.call_url).hostname}</span>}
                    </div>
                    {m.status === "live" && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                        <Video className="h-3.5 w-3.5" /> Join Live Call →
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {(rsvps ?? [])?.map((r) => {
            const m = getMeeting(r);
            if (!m) return null;
            const spaceName = getSpaceName(m.spaces);
            return (
              <Link key={m.id} href={`/app/meetings/${m.id}`} className="block">
                <Card className={`transition-colors hover:bg-accent/50 ${m.status === "live" ? "border-green-500/40 bg-green-500/5" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        {m.status === "live" && (
                          <Badge className="gap-1 bg-green-500/15 text-green-600 dark:text-green-400">
                            <Video className="h-3 w-3 animate-pulse" /> LIVE
                          </Badge>
                        )}
                        <Badge className={STATUS_COLORS[m.status]} variant="secondary">{m.status}</Badge>
                        <Badge variant="outline">{r.rsvp_status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{format(new Date(m.starts_at), "MMM d, yyyy · h:mm a")}</span>
                      {spaceName && <span>📚 {spaceName}</span>}
                    </div>
                    {m.status === "live" && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                        <Video className="h-3.5 w-3.5" /> Join Live Call →
                      </span>
                    )}
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

export default function MeetingsPage() {
  return (
    <Suspense fallback={<ListSkeleton count={4} />}>
      <MeetingsContent />
    </Suspense>
  );
}
