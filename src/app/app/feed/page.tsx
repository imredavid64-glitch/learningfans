import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  CommunityFeed,
  type FeedMaterialItem,
  type FeedThreadItem,
} from "@/components/community/community-feed";
import type { MaterialType } from "@/lib/constants";

function norm<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export default async function FeedPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // My communities: spaces I've joined, plus every public space (browsable).
  const [{ data: memberships }, { data: publicSpaces }] = await Promise.all([
    supabase.from("space_members").select("space_id").eq("user_id", profile!.id),
    supabase.from("spaces").select("id").eq("is_public", true),
  ]);

  const ids = [
    ...new Set([
      ...(memberships ?? []).map((m) => m.space_id),
      ...(publicSpaces ?? []).map((s) => s.id),
    ]),
  ];

  const [threadsRes, materialsRes] = await Promise.all([
    ids.length
      ? supabase
          .from("threads")
          .select("id, title, body, created_at, flair_id, score, profiles(display_name), spaces(name, slug)")
          .in("space_id", ids)
          .eq("is_hidden", false)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
    ids.length
      ? supabase
          .from("study_materials")
          .select("id, type, title, description, created_at, profiles(display_name), spaces(name, slug)")
          .in("space_id", ids)
          .eq("is_hidden", false)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);

  const threads: FeedThreadItem[] = (threadsRes.data ?? []).map((t) => {
    const space = norm(t.spaces as { name?: string; slug?: string });
    const author = norm(t.profiles as { display_name?: string } | null);
    return {
      id: t.id,
      title: t.title,
      body: (t.body as string | null) ?? null,
      flair_id: (t.flair_id as string | null) ?? null,
      created_at: t.created_at,
      score: (t.score as number) ?? 0,
      spaceSlug: space?.slug ?? "",
      spaceName: space?.name ?? "Community",
      authorName: author?.display_name ?? null,
    };
  });

  const materials: FeedMaterialItem[] = (materialsRes.data ?? []).map((m) => {
    const space = norm(m.spaces as { name?: string; slug?: string });
    const author = norm(m.profiles as { display_name?: string } | null);
    return {
      id: m.id,
      type: m.type as MaterialType,
      title: m.title,
      description: (m.description as string | null) ?? null,
      created_at: m.created_at,
      spaceSlug: space?.slug ?? "",
      spaceName: space?.name ?? "Community",
      authorName: author?.display_name ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Community feed</h1>
        <p className="mt-1 text-muted-foreground">
          Recent discussions and study materials from your communities.
        </p>
      </div>
      <CommunityFeed threads={threads} materials={materials} />
    </div>
  );
}
