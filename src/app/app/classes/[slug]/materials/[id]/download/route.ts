import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

interface DownloadParams {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_req: Request, { params }: DownloadParams) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("study_materials")
    .select("space_id, storage_path, title")
    .eq("id", id)
    .single();

  if (!material || !material.storage_path) return notFound();

  const { data: membership } = await supabase
    .from("space_members")
    .select("id")
    .eq("space_id", material.space_id)
    .eq("user_id", profile.id)
    .single();

  if (!membership) return notFound();

  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(material.storage_path, 60);

  if (error || !data) return notFound();

  return Response.redirect(data.signedUrl);
}
