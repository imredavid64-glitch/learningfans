import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEvent, rsvpToEvent } from "@/actions/schedule";
import { Calendar, Plus, MapPin, Users, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, isSameDay, eachDayOfInterval } from "date-fns";

interface SchedulePageProps {
  params: Promise<{ slug: string }>;
}

interface EventAuthor {
  display_name: string | null;
  avatar_url: string | null;
}

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
  room?: string | null;
  description?: string | null;
  profiles?: EventAuthor | EventAuthor[] | null;
}

export default async function ClassSchedulePage({ params }: SchedulePageProps) {
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

  // Get events for current week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const { data: events } = await supabase
    .from("schedule_events")
    .select(`
      *,
      profiles!inner(display_name, avatar_url)
    `)
    .eq("space_id", classData.id)
    .eq("visibility", "space")
    .gte("starts_at", weekStart.toISOString())
    .lte("starts_at", weekEnd.toISOString())
    .order("starts_at", { ascending: true });

  // Get user's RSVPs
  const eventIds = events?.map(e => e.id) || [];
  const { data: rsvps } = await supabase
    .from("event_attendees")
    .select("*")
    .in("event_id", eventIds)
    .eq("user_id", profile.id);

  const rsvpMap = new Map(rsvps?.map(r => [r.event_id, r.status]) || []);

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Pre-compute day events for each day
  const dayEventsMap = new Map(
    days.map(day => [
      day.toISOString(),
      events?.filter(e => isSameDay(new Date(e.starts_at), day)) || []
    ])
  );

  // Helper to render events for a day
  const renderDayEvents = (dayEvents: EventRow[]) => {
    if (dayEvents.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">No events</p>;
    }
    return dayEvents.map((event) => {
      return (
        <div 
          key={event.id} 
          className="p-2 bg-muted/50 rounded-lg border-l-4 border-primary"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{event.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(event.starts_at), "h:mm a")}
                {event.room && (
                  <>
                    <span>•</span>
                    <MapPin className="h-3 w-3" />
                    {event.room}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {rsvpMap.get(event.id) === "going" && (
                <Badge variant="default" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" />
                  Going
                </Badge>
              )}
              {rsvpMap.get(event.id) === "maybe" && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Maybe
                </Badge>
              )}
              {!rsvpMap.has(event.id) && (
                <form action={rsvpToEvent.bind(null, event.id, "going")}>
                  <Button type="submit" variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-3 w-3" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  // Helper to render events list
  const renderEventsList = (eventList: EventRow[]) => {
    if (!eventList.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No upcoming events for this class</p>
        </div>
      );
    }
    return eventList.map((event) => {
      const author = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
      return (
        <div key={event.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50">
          <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{event.title}</h4>
              <Badge variant="secondary" className="text-xs">
                {format(new Date(event.starts_at), "MMM d, h:mm a")}
              </Badge>
              {event.room && (
                <Badge variant="outline" className="text-xs gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.room}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{event.description || "No description"}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                By {author?.display_name}
              </span>
              <div className="flex items-center gap-2">
                {!rsvpMap.has(event.id) && (
                  <form action={rsvpToEvent.bind(null, event.id, "going")}>
                    <Button type="submit" variant="ghost" size="sm" className="gap-1 h-8 px-3">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      RSVP
                    </Button>
                  </form>
                )}
                {rsvpMap.get(event.id) === "going" && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Going
                  </Badge>
                )}
                {rsvpMap.get(event.id) === "maybe" && (
                  <Badge variant="secondary" className="gap-1">
                    Maybe
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

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
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground mt-1">Class events, office hours, and study sessions</p>
        </div>
        {(isEnrolled || isInstructor) && (
          <ButtonLink href={`/app/schedule?space=${classData.id}`} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </ButtonLink>
        )}
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="gap-1">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4">
          <span className="font-medium">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="gap-1">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid gap-4 md:grid-cols-7">
        {days.map((day) => {
          const dayEvents = dayEventsMap.get(day.toISOString()) || [];
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toISOString()} className={isToday ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{dayNames[day.getDay()]}</span>
                    <span className={`text-xl font-bold`}>
                      {format(day, "d")}
                    </span>
                  </div>
                  {isToday && <Badge variant="secondary" className="text-xs">Today</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {dayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No events</p>
                ) : (
                  renderDayEvents(dayEvents)
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* New Event Form (Instructor Only) */}
      {isInstructor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createEvent}>
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="spaceId" value={classData.id} />
                <input type="hidden" name="visibility" value="space" />
                <div>
                  <label className="block text-sm font-medium mb-1">Event Title</label>
                  <Input name="title" placeholder="Study Session, Office Hours, Exam Review..." required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date & Time</label>
                  <Input name="startsAt" type="datetime-local" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date & Time</label>
                  <Input name="endsAt" type="datetime-local" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Room (Optional)</label>
                  <Input name="room" placeholder="e.g., Room 101, Zoom Link" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea name="description" placeholder="Event details, agenda, materials to bring..." rows={3} />
              </div>
              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allDay" className="rounded" />
                  All day event
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1">Visibility</label>
                  <Select name="visibility" defaultValue="space">
                    <SelectTrigger>
                      <SelectValue placeholder="Class Event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="space">Class Event (visible to all enrolled)</SelectItem>
                      <SelectItem value="private">Private (instructor only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {renderEventsList(events || [])}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}