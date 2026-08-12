import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { createThread, toggleThreadPin, toggleThreadLock } from "@/actions/discussion";
import { leaveSpace } from "@/actions/spaces";
import { ReportButton } from "@/components/moderation/report-button";
import { CommunityAdmin } from "@/components/community/community-admin";
import type { CommunityAnnouncement, CommunityRule } from "@/lib/community";
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
import { Megaphone, ScrollText, ShieldCheck } from "lucide-react";

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

  const { data: moderators } = await supabase
    .from("space_members")
    .select("profiles(display_name)")
    .eq("space_id", space.id)
    .eq("role", "moderator");

  const { data: threads } = await supabase
    .from("threads")
    .select("*, profiles(display_name)")
    .eq("space_id", space.id)
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const isMod = isModerator(profile!.role) || membership?.role === "moderator";
  const rules = (Array.isArray(space.rules) ? space.rules : []) as CommunityRule[];
  const announcements = (Array.isArray(space.announcements) ? space.announcements : []) as CommunityAnnouncement[];
  const modNames = (moderators ?? [])
    .map((m) => {
      const raw = m.profiles;
      return (Array.isArray(raw) ? raw[0] : raw) as { display_name: string } | null;
    })
    .map((p) => p?.display_name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{space.name}</h1>
          <p className="text-muted-foreground">{space.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {space.is_public && <Badge>Public</Badge>}
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              {modNames.length} moderator{modNames.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/app/spaces/${slug}/materials`} variant="outline">
            Materials
          </ButtonLink>
          <ButtonLink href={`/app/study-rooms?space=${space.id}`} variant="outline">
            Study room
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

      {/* Community announcements (posted by moderators) */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Megaphone className="h-4 w-4" /> Announcements
          </h2>
          {announcements.map((a) => (
            <div key={a.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">📌 {a.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.author_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </span>
              </div>
              {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Main column: discussion */}
        <div className="min-w-0">
          <Tabs defaultValue="discussion">
            <TabsList>
              <TabsTrigger value="discussion">Discussion</TabsTrigger>
              <TabsTrigger value="new">New thread</TabsTrigger>
            </TabsList>
            <TabsContent value="discussion" className="mt-4 space-y-3">
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

        {/* Sidebar: about / rules / mods */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">About this community</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {space.description && (
                <p className="text-muted-foreground">{space.description}</p>
              )}
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Moderators
                </p>
                <p>{modNames.length ? modNames.join(", ") : "No moderators yet"}</p>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ScrollText className="h-3.5 w-3.5" /> Rules
                </p>
                {rules.length === 0 ? (
                  <p className="text-muted-foreground">No rules set yet.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {rules.map((r, i) => (
                      <li key={r.id}>
                        <p className="font-medium">
                          <span className="text-primary">{i + 1}.</span> {r.title}
                        </p>
                        {r.body && <p className="text-xs text-muted-foreground">{r.body}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>

          {isMod && (
            <CommunityAdmin
              spaceId={space.id}
              initialRules={rules}
              initialAnnouncements={announcements}
            />
          )}
        </div>
      </div>
    </div>
  );
}
