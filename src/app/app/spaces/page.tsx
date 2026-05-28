import Link from "next/link";
import { createSpace, joinSpace } from "@/actions/spaces";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
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
import { Badge } from "@/components/ui/badge";

export default async function SpacesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: mySpaces } = await supabase
    .from("space_members")
    .select("space_id, spaces(*)")
    .eq("user_id", profile!.id);

  const memberIds = mySpaces?.map((m) => m.space_id) ?? [];

  const { data: publicSpaces } = await supabase
    .from("spaces")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const joinedSet = new Set(memberIds);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study spaces</h1>
          <p className="text-muted-foreground">
            Create or join spaces for your courses and study groups.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a space</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSpace} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input id="slug" name="slug" placeholder="e.g. calculus-101" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="isPublic" className="rounded" />
              Public — anyone can join
            </label>
            <Button type="submit" className="sm:col-span-2 w-fit">
              Create space
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Your spaces</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {mySpaces?.map((m) => {
            const raw = m.spaces;
            const space = (Array.isArray(raw) ? raw[0] : raw) as {
              id: string;
              name: string;
              slug: string;
              description: string | null;
            };
            return (
              <Card key={space.id}>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/app/spaces/${space.slug}`}>{space.name}</Link>
                  </CardTitle>
                  <CardDescription>{space.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ButtonLink href={`/app/spaces/${space.slug}`} size="sm">
                    Open
                  </ButtonLink>
                </CardContent>
              </Card>
            );
          })}
          {!mySpaces?.length && (
            <p className="text-sm text-muted-foreground">Join or create a space to get started.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Public spaces</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {publicSpaces?.map((space) => (
            <Card key={space.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{space.name}</CardTitle>
                  <Badge>Public</Badge>
                </div>
                <CardDescription>{space.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                {joinedSet.has(space.id) ? (
                  <ButtonLink href={`/app/spaces/${space.slug}`} size="sm">
                    Open
                  </ButtonLink>
                ) : (
                  <form action={joinSpace.bind(null, space.id)}>
                    <Button type="submit" size="sm">
                      Join
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
