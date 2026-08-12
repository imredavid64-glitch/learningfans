"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export interface SearchResult {
  kind: "space" | "thread" | "material" | "person";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  await requireProfile();
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${escapeLike(q)}%`;
  const results: SearchResult[] = [];

  // Spaces (RLS limits to public or member spaces)
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name, slug")
    .ilike("name", like)
    .limit(5);

  for (const s of spaces ?? []) {
    results.push({ kind: "space", id: s.id, title: s.name, href: `/app/spaces/${s.slug}` });
  }

  // Threads (RLS limits to accessible spaces, hides hidden threads)
  const { data: threads } = await supabase
    .from("threads")
    .select("id, title, spaces(slug, name)")
    .or(`title.ilike.${like},body.ilike.${like}`)
    .order("created_at", { ascending: false })
    .limit(8);

  for (const t of threads ?? []) {
    const space = Array.isArray(t.spaces) ? t.spaces[0] : t.spaces;
    results.push({
      kind: "thread",
      id: t.id,
      title: t.title,
      subtitle: space?.name,
      href: `/app/spaces/${space?.slug ?? "unknown"}/threads/${t.id}`,
    });
  }

  // Materials (RLS limits to accessible spaces, hides hidden materials)
  const { data: materials } = await supabase
    .from("study_materials")
    .select("id, title, spaces(slug, name)")
    .ilike("title", like)
    .order("created_at", { ascending: false })
    .limit(8);

  for (const m of materials ?? []) {
    const space = Array.isArray(m.spaces) ? m.spaces[0] : m.spaces;
    results.push({
      kind: "material",
      id: m.id,
      title: m.title,
      subtitle: space?.name,
      href: `/app/classes/${space?.slug ?? "unknown"}/materials/${m.id}`,
    });
  }

  // People
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, major")
    .ilike("display_name", like)
    .limit(5);

  for (const p of people ?? []) {
    results.push({
      kind: "person",
      id: p.id,
      title: p.display_name,
      subtitle: p.major ?? "Student",
      href: `/app/profile/${p.id}`,
    });
  }

  return results;
}
