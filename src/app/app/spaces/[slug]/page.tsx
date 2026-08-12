import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { createThread } from "@/actions/discussion";
import { leaveSpace } from "@/actions/spaces";
import { CommunityAdmin } from "@/components/community/community-admin";
import { ThreadFeed, type FeedThread } from "@/components/community/thread-feed";
import type { CommunityAnnouncement, CommunityFlair, CommunityRule } from "@/lib/community";
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
  const flairs = (Array.isArray(space.flairs) ? space.flairs : []) as CommunityFlair[];

  // The current user's votes on the visible threads (Reddit-style voting).
  const threadIds = (threads ?? []).map((t) => t.id);
  const { data: myVotes } = threadIds.length
    ? await supabase
        .from("post_votes")
        .select("post_id, vote")
        .eq("user_id", profile!.id)
        .in("post_id", threadIds)
    : { data: null };
  const userVotes: Record<string, 1 | -1 | 0> = {};
  for (const v of myVotes ?? []) {
    userVotes[v.post_id] = v.vote;
  }

  const feedThreads: FeedThread[] = (threads ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    flair_id: t.flair_id ?? null,
    is_pinned: t.is_pinned,
    is_locked: t.is_locked,
    score: t.score ?? 0,
    ups: t.ups ?? 0,
    downs: t.downs ?? 0,
    created_at: t.created_at,
    profiles: (t.profiles as { display_name: string } | null) ?? null,
  }));
  const modNames = (moderators ?? [])
    .map((m) => {
      const raw = m.profiles;
      return (Array.isArray(raw) ? raw[0] : raw) as { display_name: string } | null;
    })
    .map((p) => p?.display_name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="space-y-6">
      {space.banner_url && (
        <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border sm:h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={space.banner_url}
            alt={`${space.name} banner`}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {space.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={space.icon_url}
              alt={`${space.name} icon`}
              className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
              {(space.name ?? "?")[0]?.toUpperCase()}
            </div>
          )}
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
          <ButtonLink href={`/app/spaces/${slug}/leaderboard`} variant="outline">
            Leaderboard
          </ButtonLink>
          {isMod && (
            <ButtonLink href={`/app/spaces/${slug}/moderation`} variant="outline">
              Mod dashboard
            </ButtonLink>
          )}
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
            <TabsContent value="discussion" className="mt-4">
              <ThreadFeed
                threads={feedThreads}
                userVotes={userVotes}
                slug={slug}
                isMod={isMod}
                flairs={flairs}
              />
            </TabsContent>
            <TabsContent value="new" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <form action={createThread.bind(null, slug)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" name="title" required />
                    </div>
                    {flairs.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="flair">Flair</Label>
                        <select
                          id="flair"
                          name="flair"
                          defaultValue=""
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">No flair</option>
                          {flairs.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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
              initialFlairs={flairs}
              initialIconUrl={space.icon_url}
              initialBannerUrl={space.banner_url}
            />
          )}
        </div>
      </div>
    </div>
  );
}
