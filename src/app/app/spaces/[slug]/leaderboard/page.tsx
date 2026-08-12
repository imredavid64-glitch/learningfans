import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  CommunityLeaderboard,
  type LeaderboardRow,
} from "@/components/community/community-leaderboard";

function norm<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export default async function SpaceLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!space) notFound();

  const { data: memberships } = await supabase
    .from("space_members")
    .select("user_id, role, profiles(id, display_name, avatar_url)")
    .eq("space_id", space.id);

  const memberIds = (memberships ?? []).map((m) => m.user_id);

  const [{ data: stats }, threadsRes, materialsRes, postsRes] = await Promise.all([
    memberIds.length
      ? supabase
          .from("user_stats")
          .select("user_id, total_xp, current_streak")
          .in("user_id", memberIds)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase
          .from("threads")
          .select("author_id")
          .eq("space_id", space.id)
          .eq("is_hidden", false)
          .limit(1000)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase
          .from("study_materials")
          .select("author_id")
          .eq("space_id", space.id)
          .eq("is_hidden", false)
          .limit(1000)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase
          .from("posts")
          .select("author_id, threads!inner(space_id)")
          .eq("threads.space_id", space.id)
          .eq("is_hidden", false)
          .limit(1000)
      : Promise.resolve({ data: [] }),
  ]);

  const xpByUser = new Map(
    (stats ?? []).map((s) => [s.user_id, { xp: Number(s.total_xp) || 0, streak: Number(s.current_streak) || 0 }]),
  );
  const countBy = (rows: { author_id: string }[]) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.author_id, (map.get(r.author_id) ?? 0) + 1);
    return map;
  };
  const threadCounts = countBy((threadsRes.data ?? []) as { author_id: string }[]);
  const materialCounts = countBy((materialsRes.data ?? []) as { author_id: string }[]);
  const replyCounts = countBy((postsRes.data ?? []) as { author_id: string }[]);

  const rows: LeaderboardRow[] = (memberships ?? [])
    .map((m) => {
      const p = norm(m.profiles as { id?: string; display_name?: string; avatar_url?: string | null } | null);
      const xp = xpByUser.get(m.user_id)?.xp ?? 0;
      const threads = threadCounts.get(m.user_id) ?? 0;
      const materials = materialCounts.get(m.user_id) ?? 0;
      const replies = replyCounts.get(m.user_id) ?? 0;
      return {
        userId: m.user_id,
        name: p?.display_name ?? "Anonymous",
        avatarUrl: p?.avatar_url ?? null,
        role: m.role as string,
        xp,
        level: Math.floor(xp / 100) + 1,
        streak: xpByUser.get(m.user_id)?.streak ?? 0,
        threads,
        materials,
        replies,
        contributions: threads + materials + replies,
        isMe: m.user_id === profile!.id,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.contributions - a.contributions);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/spaces/${slug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {space.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Community leaderboard</h1>
        <p className="mt-1 text-muted-foreground">
          Top contributors in this community by XP and activity.
        </p>
      </div>
      <CommunityLeaderboard rows={rows} />
    </div>
  );
}
