import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { createThread, toggleThreadPin, toggleThreadLock } from "@/actions/discussion";
import { leaveSpace } from "@/actions/spaces";
import { ReportButton } from "@/components/moderation/report-button";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!space) notFound();

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", space.id)
    .eq("user_id", profile!.id)
    .maybeSingle();

  const { data: threads } = await supabase
    .from("threads")
    .select("*, profiles(display_name)")
    .eq("space_id", space.id)
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const isMod = isModerator(profile!.role) || membership?.role === "moderator";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{space.name}</h1>
          <p className="text-muted-foreground">{space.description}</p>
          {space.is_public && <Badge className="mt-2">Public</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/app/spaces/${slug}/materials`} variant="outline">
            Materials
          </ButtonLink>
          <ButtonLink href={`/app/schedule?space=${space.id}`} variant="outline">
            Space schedule
          </ButtonLink>
          {membership && (
            <form action={leaveSpace.bind(null, space.id)}>
              <Button type="submit" variant="ghost" size="sm">
                Leave space
              </Button>
            </form>
          )}
        </div>
      </div>

      <Tabs defaultValue="discussion">
        <TabsList>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
          <TabsTrigger value="new">New thread</TabsTrigger>
        </TabsList>
        <TabsContent value="discussion" className="space-y-3 mt-4">
          {threads?.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link
                      href={`/app/spaces/${slug}/threads/${t.id}`}
                      className="hover:underline"
                    >
                      {t.title}
                    </Link>
                  </CardTitle>
                  <div className="flex gap-1">
                    {t.is_pinned && <Badge>Pinned</Badge>}
                    {t.is_locked && <Badge variant="outline">Locked</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {(t.profiles as { display_name: string })?.display_name} ·{" "}
                  {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                </span>
                <div className="flex gap-2">
                  <ReportButton targetType="thread" targetId={t.id} />
                  {isMod && (
                    <>
                      <form
                        action={toggleThreadPin.bind(null, t.id, !t.is_pinned)}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          {t.is_pinned ? "Unpin" : "Pin"}
                        </Button>
                      </form>
                      <form
                        action={toggleThreadLock.bind(null, t.id, !t.is_locked)}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          {t.is_locked ? "Unlock" : "Lock"}
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!threads?.length && (
            <p className="text-sm text-muted-foreground">No threads yet. Start one!</p>
          )}
        </TabsContent>
        <TabsContent value="new" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form action={createThread.bind(null, slug)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">First post</Label>
                  <Textarea id="body" name="body" rows={4} />
                </div>
                <Button type="submit">Create thread</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
