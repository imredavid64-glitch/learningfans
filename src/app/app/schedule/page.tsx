import { format } from "date-fns";
import { createEvent, deleteEvent, rsvpToEvent } from "@/actions/schedule";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space: filterSpaceId } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: personalEvents } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("owner_id", profile!.id)
    .eq("visibility", "private")
    .order("starts_at", { ascending: true });

  const { data: memberships } = await supabase
    .from("space_members")
    .select("space_id, spaces(id, name)")
    .eq("user_id", profile!.id);

  const spaceIds = memberships?.map((m) => m.space_id) ?? [];

  const { data: sharedEvents } = await supabase
    .from("schedule_events")
    .select("*, spaces(name, slug)")
    .eq("visibility", "space")
    .in("space_id", spaceIds.length ? spaceIds : ["00000000-0000-0000-0000-000000000000"])
    .order("starts_at", { ascending: true });

  const filteredShared = filterSpaceId
    ? sharedEvents?.filter((e) => e.space_id === filterSpaceId)
    : sharedEvents;

  const { data: materials } = await supabase
    .from("study_materials")
    .select("id, title, space_id")
    .in("space_id", spaceIds.length ? spaceIds : ["00000000-0000-0000-0000-000000000000"])
    .limit(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">
          Personal study planner and shared space events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New event</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createEvent} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select
                id="visibility"
                name="visibility"
                defaultValue="private"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="private">Personal</option>
                <option value="space">Shared (space)</option>
              </select>
            </div>
            {spaceIds.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="spaceId">Class/Space</Label>
                <select
                  id="spaceId"
                  name="spaceId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {memberships?.map((m) => (
                    <option key={m.space_id} value={m.space_id}>
                      {(m.spaces as any)?.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="spaceId">Space (for shared)</Label>
              <select
                id="spaceId"
                name="spaceId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">—</option>
                {memberships?.map((m) => {
                  const raw = m.spaces;
                  const s = (Array.isArray(raw) ? raw[0] : raw) as {
                    id: string;
                    name: string;
                  };
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="linkedMaterialId">Link material (optional)</Label>
              <select
                id="linkedMaterialId"
                name="linkedMaterialId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">None</option>
                {materials?.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder">Reminder (minutes before)</Label>
              <Input id="reminder" name="reminder" type="number" placeholder="30" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allDay" />
              All day
            </label>
            <Button type="submit" className="sm:col-span-2 w-fit">
              Add event
            </Button>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="shared">Shared</TabsTrigger>
        </TabsList>
        <TabsContent value="personal" className="mt-4 space-y-3">
          {personalEvents?.map((e) => (
            <EventCard key={e.id} event={e} showDelete />
          ))}
          {!personalEvents?.length && (
            <p className="text-sm text-muted-foreground">No personal events.</p>
          )}
        </TabsContent>
        <TabsContent value="shared" className="mt-4 space-y-3">
          {filteredShared?.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              spaceName={(e.spaces as { name: string })?.name}
              showAttendance
            />
          ))}
          {!filteredShared?.length && (
            <p className="text-sm text-muted-foreground">No shared events.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventCard({
  event,
  spaceName,
  showDelete,
  showAttendance,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string;
    visibility: string;
  };
  spaceName?: string;
  showDelete?: boolean;
  showAttendance?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{event.title}</CardTitle>
          <Badge variant="outline">{event.visibility}</Badge>
        </div>
        {spaceName && <CardDescription>{spaceName}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        {event.description && (
          <p className="text-sm text-muted-foreground">{event.description}</p>
        )}
        <p className="text-sm">
          {format(new Date(event.starts_at), "MMM d, yyyy h:mm a")} —{" "}
          {format(new Date(event.ends_at), "h:mm a")}
        </p>
        <div className="flex gap-2">
          {showDelete && (
            <form action={deleteEvent.bind(null, event.id)}>
              <Button type="submit" variant="destructive" size="sm">
                Delete
              </Button>
            </form>
          )}
          {showAttendance && (
            <>
              <form action={rsvpToEvent.bind(null, event.id, "going")}>
                <Button type="submit" size="sm" variant="secondary">
                  Going
                </Button>
              </form>
              <form action={rsvpToEvent.bind(null, event.id, "maybe")}>
                <Button type="submit" size="sm" variant="outline">
                  Maybe
                </Button>
              </form>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
