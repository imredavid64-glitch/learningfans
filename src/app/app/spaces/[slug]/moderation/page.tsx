import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import { AutomodEditor } from "@/components/community/automod-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, History } from "lucide-react";
import type { AutomodRule } from "@/lib/automod";

export default async function SpaceModerationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("id, name, automod_rules")
    .eq("slug", slug)
    .single();
  if (!space) notFound();

  const { data: membership } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", space.id)
    .eq("user_id", profile!.id)
    .maybeSingle();

  const canMod = isModerator(profile!.role) || membership?.role === "moderator";
  if (!canMod) redirect(`/app/spaces/${slug}`);

  const automodRules = (Array.isArray(space.automod_rules) ? space.automod_rules : []) as AutomodRule[];

  const { data: history } = await supabase
    .from("moderation_actions")
    .select("*, profiles(display_name)")
    .eq("space_id", space.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (history ?? []).map((h) => ({
    id: h.id,
    action: h.action as string,
    target_type: h.target_type as string,
    note: (h.note as string | null) ?? null,
    created_at: h.created_at,
    actor: (Array.isArray(h.profiles) ? h.profiles[0] : h.profiles) as
      | { display_name: string }
      | null,
  }));

  const actionStyles: Record<string, string> = {
    auto_flag: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    pin: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    unpin: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    lock: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    unlock: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    hide: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/spaces/${slug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {space.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Mod dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Automod rules and moderation history for this community.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" /> Automod rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AutomodEditor spaceId={space.id} initialRules={automodRules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Mod action history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No moderation actions recorded yet — automod flags and moderator
              actions will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={actionStyles[r.action] ?? ""}
                    >
                      {r.action.replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary">{r.target_type}</Badge>
                    {r.note && (
                      <span className="truncate text-muted-foreground">{r.note}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.actor?.display_name ?? "System"} ·{" "}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
