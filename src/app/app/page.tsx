import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("space_members")
    .select("spaces(id, name, slug)")
    .eq("user_id", profile.id)
    .limit(6);

  const { data: priorities } = await supabase
    .from("user_material_rankings")
    .select("*")
    .eq("user_id", profile.id)
    .order("rank_score", { ascending: false })
    .limit(5);

  const { data: events } = await supabase
    .from("schedule_events")
    .select("*")
    .or(`owner_id.eq.${profile.id},visibility.eq.space`)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {profile.display_name}</h1>
        <p className="text-muted-foreground">
          Your study hub — spaces, priorities, and upcoming events.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Your spaces</CardTitle>
            <CardDescription>Study groups you belong to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberships?.length ? (
              memberships.map((m) => {
                const raw = m.spaces;
                const space = (Array.isArray(raw) ? raw[0] : raw) as {
                  id: string;
                  name: string;
                  slug: string;
                } | null;
                if (!space) return null;
                return (
                  <Link
                    key={space.id}
                    href={`/app/spaces/${space.slug}`}
                    className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    {space.name}
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No spaces yet.</p>
            )}
            <ButtonLink href="/app/spaces" variant="outline" size="sm" className="mt-2">
              Browse spaces
            </ButtonLink>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Top priorities</CardTitle>
            <CardDescription>Materials ranked for you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorities?.length ? (
              priorities.map((p) => (
                <div
                  key={p.material_id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate">{p.title}</span>
                  <Badge variant="secondary">{p.priority}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Set priorities on materials in your spaces.
              </p>
            )}
            <ButtonLink href="/app/priorities" variant="outline" size="sm" className="mt-2">
              View all
            </ButtonLink>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Schedule at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {events?.length ? (
              events.map((e) => (
                <div
                  key={e.id}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.starts_at), "MMM d, h:mm a")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            )}
            <ButtonLink href="/app/schedule" variant="outline" size="sm" className="mt-2">
              Open schedule
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
