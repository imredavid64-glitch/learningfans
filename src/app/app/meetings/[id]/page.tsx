import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelMeeting, rsvpMeeting } from "@/actions/meetings";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-500",
  live: "bg-green-500/10 text-green-500",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default async function MeetingDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, organizer:profiles!organizer_id(display_name), spaces(name, slug)")
    .eq("id", id)
    .single();

  if (!meeting) notFound();

  const { data: participants } = await supabase
    .from("meeting_participants")
    .select("user_id, rsvp_status, profiles(display_name, avatar_url)")
    .eq("meeting_id", id);

  const myRsvp = participants?.find((p) => p.user_id === profile.id);
  const isOrganizer = meeting.organizer_id === profile.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{meeting.title}</CardTitle>
              <Badge className={STATUS_COLORS[meeting.status]} variant="secondary">{meeting.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">When</p>
              <p className="font-medium">{format(new Date(meeting.starts_at), "EEEE, MMM d, yyyy")}</p>
              <p className="font-medium">{format(new Date(meeting.starts_at), "h:mm a")} – {format(new Date(meeting.ends_at), "h:mm a")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Organizer</p>
              <p className="font-medium">{meeting.organizer?.display_name || "Unknown"}</p>
            </div>
            {meeting.spaces && (
              <div>
                <p className="text-muted-foreground">Space</p>
                <p className="font-medium">{meeting.spaces.name}</p>
              </div>
            )}
          </div>

          {meeting.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-sm">{meeting.description}</p>
            </div>
          )}

          {meeting.call_url && (
            <a
              href={meeting.call_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Join call ↗
            </a>
          )}
        </CardContent>
      </Card>

      {meeting.status === "scheduled" && !isOrganizer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your RSVP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <form action={rsvpMeeting.bind(null, id, "going")}>
                <Button type="submit" variant={myRsvp?.rsvp_status === "going" ? "default" : "outline"}>
                  Going
                </Button>
              </form>
              <form action={rsvpMeeting.bind(null, id, "maybe")}>
                <Button type="submit" variant={myRsvp?.rsvp_status === "maybe" ? "default" : "outline"}>
                  Maybe
                </Button>
              </form>
              <form action={rsvpMeeting.bind(null, id, "declined")}>
                <Button type="submit" variant={myRsvp?.rsvp_status === "declined" ? "destructive" : "outline"}>
                  Decline
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participants ({participants?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!participants?.length ? (
            <p className="text-sm text-muted-foreground">No participants yet.</p>
          ) : (
            <ul className="space-y-2">
              {participants.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between text-sm">
                  <span>{p.profiles?.[0]?.display_name || "Unknown"}</span>
                  <Badge variant="outline">{p.rsvp_status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isOrganizer && meeting.status === "scheduled" && (
        <form action={cancelMeeting.bind(null, id)}>
          <Button variant="destructive" type="submit">Cancel meeting</Button>
        </form>
      )}
    </div>
  );
}
