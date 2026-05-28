import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  createLinkMaterial,
  createNoteMaterial,
  createFlashcardMaterial,
  uploadFileMaterial,
} from "@/actions/materials";
import { MaterialList } from "@/components/materials/material-list";
import { Button } from "@/components/ui/button";
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
import { MAX_FILE_SIZE_BYTES, USER_STORAGE_QUOTA_BYTES } from "@/lib/constants";

export default async function MaterialsPage({
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

  const { data: materials } = await supabase
    .from("study_materials")
    .select("*, profiles(display_name)")
    .eq("space_id", space.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  const { data: upvotes } = await supabase
    .from("material_upvotes")
    .select("material_id")
    .eq("user_id", profile!.id);

  const userUpvotes = new Set(upvotes?.map((u) => u.material_id) ?? []);
  const storagePct = Math.round(
    (profile!.storage_used_bytes / USER_STORAGE_QUOTA_BYTES) * 100,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/app/spaces/${slug}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {space.name}
          </Link>
          <h1 className="text-2xl font-bold">Study materials</h1>
          <p className="text-sm text-muted-foreground">
            Storage: {storagePct}% of 25 MB used (max {MAX_FILE_SIZE_BYTES / 1024 / 1024} MB per file)
          </p>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All materials</TabsTrigger>
          <TabsTrigger value="file">Upload file</TabsTrigger>
          <TabsTrigger value="link">Add link</TabsTrigger>
          <TabsTrigger value="note">Note</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <MaterialList
            materials={materials ?? []}
            spaceSlug={slug}
            userUpvotes={userUpvotes}
          />
        </TabsContent>
        <TabsContent value="file" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload file</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={uploadFileMaterial.bind(null, slug)}
                className="space-y-4"
                encType="multipart/form-data"
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">File (PDF, images, text — max 5 MB)</Label>
                  <Input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md" />
                </div>
                <Button type="submit">Upload</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="link" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form action={createLinkMaterial.bind(null, slug)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input id="url" name="url" type="url" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" rows={2} />
                </div>
                <Button type="submit">Add link</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="note" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form action={createNoteMaterial.bind(null, slug)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content (max 50 KB)</Label>
                  <Textarea id="content" name="content" rows={8} required />
                </div>
                <Button type="submit">Save note</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="flashcards" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form action={createFlashcardMaterial.bind(null, slug)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Set title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cards">
                    Cards JSON — e.g. [{"{"}&quot;front&quot;:&quot;Q&quot;,&quot;back&quot;:&quot;A&quot;{"}"}]
                  </Label>
                  <Textarea
                    id="cards"
                    name="cards"
                    rows={6}
                    defaultValue='[{"front":"Term","back":"Definition"}]'
                    required
                  />
                </div>
                <Button type="submit">Create set</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
