import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, FolderPlus, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSavedCollection } from "@/actions/saved";
import { SavedItemActions } from "@/components/saved/saved-item-actions";
import type { SavedItemType } from "@/lib/saved";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MaterialType } from "@/lib/constants";

interface SavedRow {
  itemType: SavedItemType;
  itemId: string;
  collectionId: string | null;
  createdAt: string;
  title: string;
  subtitle: string;
  href: string;
}

interface ItemMeta {
  title: string;
  href: string;
  spaceName: string;
  created_at: string;
  typeLabel?: string;
}

function norm<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export default async function SavedPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [collectionsRes, savedRes] = await Promise.all([
    supabase
      .from("saved_collections")
      .select("id, name")
      .eq("user_id", profile!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_items")
      .select("item_type, item_id, collection_id, created_at")
      .eq("user_id", profile!.id)
      .order("created_at", { ascending: false }),
  ]);

  // Graceful degradation: the feature is inert until migration 0012 is applied.
  if (collectionsRes.error || savedRes.error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Saved</h1>
          <p className="mt-1 text-muted-foreground">Your bookmarked threads and materials.</p>
        </div>
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Saving needs a one-time database setup — apply migration
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5">20260812000012_saved_items.sql</code>
          in the Supabase SQL editor to enable it.
        </p>
      </div>
    );
  }

  const collections = collectionsRes.data ?? [];
  const saved = savedRes.data ?? [];

  const threadIds = saved.filter((s) => s.item_type === "thread").map((s) => s.item_id);
  const materialIds = saved.filter((s) => s.item_type === "material").map((s) => s.item_id);

  const [threadsRes, materialsRes] = await Promise.all([
    threadIds.length
      ? supabase
          .from("threads")
          .select("id, title, created_at, spaces(name, slug)")
          .in("id", threadIds)
      : Promise.resolve({ data: [] }),
    materialIds.length
      ? supabase
          .from("study_materials")
          .select("id, type, title, created_at, spaces(name, slug)")
          .in("id", materialIds)
      : Promise.resolve({ data: [] }),
  ]);

  const threadById = new Map<string, ItemMeta>(
    (threadsRes.data ?? []).map((t) => {
      const space = norm(t.spaces as { name?: string; slug?: string });
      return [
        t.id,
        {
          title: t.title,
          href: `/app/spaces/${space?.slug ?? ""}/threads/${t.id}`,
          spaceName: space?.name ?? "Community",
          created_at: t.created_at,
        },
      ];
    }),
  );
  const materialById = new Map<string, ItemMeta>(
    (materialsRes.data ?? []).map((m) => {
      const space = norm(m.spaces as { name?: string; slug?: string });
      const hasDetailPage = m.type === "flashcard_set" || m.type === "quiz" || m.type === "file";
      return [
        m.id,
        {
          title: m.title,
          href: hasDetailPage
            ? `/app/spaces/${space?.slug ?? ""}/materials/${m.id}`
            : `/app/spaces/${space?.slug ?? ""}/materials`,
          spaceName: space?.name ?? "Community",
          typeLabel: (m.type as MaterialType).replace("_", " "),
          created_at: m.created_at,
        },
      ];
    }),
  );

  const rows: SavedRow[] = saved
    .map((s) => {
      const meta =
        s.item_type === "thread" ? threadById.get(s.item_id) : materialById.get(s.item_id);
      if (!meta) return null;
      return {
        itemType: s.item_type as SavedItemType,
        itemId: s.item_id,
        collectionId: (s.collection_id as string | null) ?? null,
        createdAt: s.created_at,
        title: meta.title,
        subtitle:
          s.item_type === "material"
            ? `${meta.typeLabel} · ${meta.spaceName}`
            : `Discussion · ${meta.spaceName}`,
        href: meta.href,
      };
    })
    .filter((r): r is SavedRow => r !== null);

  const withFolder = (collectionId: string | null) =>
    rows.filter((r) => r.collectionId === collectionId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bookmark className="h-6 w-6 text-primary" /> Saved
          </h1>
          <p className="mt-1 text-muted-foreground">
            {rows.length} saved item{rows.length === 1 ? "" : "s"} across your folders.
          </p>
        </div>
        <form action={createSavedCollection} className="flex items-center gap-2">
          <Input
            name="name"
            placeholder="New folder name"
            required
            maxLength={60}
            className="h-9 w-52"
          />
          <Button type="submit" size="sm" className="gap-1">
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing saved yet — hit the bookmark icon on a thread or material to
          collect it here.
        </p>
      ) : (
        <div className="space-y-6">
          {collections.map((c) => {
            const items = withFolder(c.id);
            if (items.length === 0) return null;
            return (
              <Section
                key={c.id}
                title={c.name}
                count={items.length}
                items={items}
                collections={collections}
              />
            );
          })}
          <Section
            title="Uncategorized"
            count={withFolder(null).length}
            items={withFolder(null)}
            collections={collections}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  items,
  collections,
}: {
  title: string;
  count: number;
  items: SavedRow[];
  collections: { id: string; name: string }[];
}) {
  if (count === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 text-muted-foreground" /> {title}
          <span className="text-xs font-normal text-muted-foreground">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((row) => (
          <div
            key={`${row.itemType}-${row.itemId}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <Link href={row.href} className="min-w-0 hover:underline">
              <p className="truncate font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {row.subtitle} ·{" "}
                {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
              </p>
            </Link>
            <SavedItemActions
              itemType={row.itemType}
              itemId={row.itemId}
              currentCollectionId={row.collectionId}
              collections={collections}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
