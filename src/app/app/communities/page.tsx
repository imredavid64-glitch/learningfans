import { createClient } from "@/lib/supabase/server";
import { CommunityDirectory } from "@/components/community/community-directory";

export default async function CommunitiesPage() {
  const supabase = await createClient();

  const { data: spaces } = await supabase
    .from("spaces")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (spaces ?? []).map((s) => s.id);
  const { data: memberRows } = ids.length
    ? await supabase.from("space_members").select("space_id").in("space_id", ids)
    : { data: null };

  const memberCounts = new Map<string, number>();
  for (const r of memberRows ?? []) {
    memberCounts.set(r.space_id, (memberCounts.get(r.space_id) ?? 0) + 1);
  }

  const communities = (spaces ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    is_public: s.is_public,
    icon_url: (s.icon_url as string | null) ?? null,
    banner_url: (s.banner_url as string | null) ?? null,
    memberCount: memberCounts.get(s.id) ?? 0,
    flairCount: Array.isArray(s.flairs) ? (s.flairs as unknown[]).length : 0,
    created_at: s.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Communities</h1>
        <p className="mt-1 text-muted-foreground">
          Browse study communities — public spaces and ones you&apos;ve joined.
        </p>
      </div>
      <CommunityDirectory communities={communities} />
    </div>
  );
}
