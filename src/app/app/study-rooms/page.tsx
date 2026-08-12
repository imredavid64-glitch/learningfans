import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { StudyRoomForm } from "@/components/study-rooms/study-room-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Presentation } from "lucide-react";

export default async function StudyRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space: defaultSpaceId } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: mySpaces } = await supabase
    .from("space_members")
    .select("spaces(id, name)")
    .eq("user_id", profile!.id);

  const spaces = (mySpaces ?? [])
    .map((m) => {
      const raw = m.spaces;
      const space = (Array.isArray(raw) ? raw[0] : raw) as { id: string; name: string } | null;
      return space;
    })
    .filter((s): s is { id: string; name: string } => Boolean(s));

  const { data: rooms, error: roomsError } = await supabase
    .from("study_rooms")
    .select("*, creator:profiles!created_by(display_name), spaces(name, slug)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(30);

  const schemaMissing =
    roomsError?.message?.includes("schema cache") ||
    roomsError?.message?.includes("does not exist") ||
    roomsError?.message?.includes("Could not find the table") ||
    roomsError?.message?.includes("PGRST205") ||
    roomsError?.message?.includes("PGRST301");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Presentation className="h-6 w-6 text-primary" />
          Study rooms
        </h1>
        <p className="text-muted-foreground">
          Live rooms with a shared whiteboard, room chat, a focus timer and a one-click video call.
          Join a room below or start your own — anyone with the link can hop in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a study room</CardTitle>
          <CardDescription>Create a room and share the invite link.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudyRoomForm spaces={spaces} defaultSpaceId={defaultSpaceId} />
        </CardContent>
      </Card>

      {schemaMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Study rooms need a one-time database setup.</strong> Apply the{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">study_rooms</code> migration in the
          Supabase SQL editor, then rooms will appear here.
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Open rooms</h2>
        {schemaMissing ? null : !rooms?.length ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No open rooms right now — be the first to start one!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rooms.map((room) => (
              <Link key={room.id} href={`/app/study-rooms/${room.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{room.name}</CardTitle>
                      <Badge className="shrink-0 gap-1.5 bg-green-500/15 text-green-600 dark:text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        Live
                      </Badge>
                    </div>
                    {room.description && (
                      <CardDescription className="line-clamp-2">{room.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {(room.creator as { display_name: string } | null)?.display_name ?? "Someone"}{" "}
                      started {formatDistanceToNow(new Date(room.created_at), { addSuffix: true })}
                    </span>
                    {room.spaces && (
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        📚 {(room.spaces as { name: string }).name}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
