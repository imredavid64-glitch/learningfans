import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

/**
 * Inline preview for PDF/image materials. The materials bucket is private and
 * serves signed URLs as attachments, so this route proxies the bytes with
 * `Content-Disposition: inline` — letting <iframe> and <img> render them.
 * Access is gated by RLS on study_materials (can_read_space).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("space_id, storage_path, title, metadata, type")
    .eq("id", id)
    .single();

  if (!material || !material.storage_path || material.type !== "file") return notFound();

  const mime = (material.metadata as { mime?: string } | null)?.mime;
  if (mime !== "application/pdf" && !mime?.startsWith("image/")) return notFound();

  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(material.storage_path, 60);

  if (error || !data) return notFound();

  const upstream = await fetch(data.signedUrl);
  if (!upstream.ok || !upstream.body) return notFound();

  return new Response(upstream.body, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(material.title)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
