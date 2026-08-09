import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { 
  FileText, 
  Link as LinkIcon, 
  BookOpen, 
  Plus, 
  Download,
  Eye,
  Award,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface MaterialsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClassMaterialsPage({ params }: MaterialsPageProps) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const supabase = await createClient();

  // Get class
  const { data: classData } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!classData) return notFound();

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("*")
    .eq("class_id", classData.id)
    .eq("student_id", profile.id)
    .single();

  const isEnrolled = !!enrollment;
  const isInstructor = classData.created_by === profile.id;

  // Get materials
  const { data: materials } = await supabase
    .from("study_materials")
    .select(`
      *,
      profiles!inner(display_name, avatar_url)
    `)
    .eq("space_id", classData.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  const typeIcons = {
    file: FileText,
    link: LinkIcon,
    note: BookOpen,
    flashcard_set: Award,
  };

  const typeColors = {
    file: "bg-blue-100 text-blue-700",
    link: "bg-green-100 text-green-700",
    note: "bg-purple-100 text-purple-700",
    flashcard_set: "bg-yellow-100 text-yellow-700",
  };

  const typeLabels = {
    file: "File",
    link: "Link",
    note: "Note",
    flashcard_set: "Assignment",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href={`/app/classes/${slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {classData.name}
          </Link>
          <h1 className="text-3xl font-bold">Study Materials</h1>
          <p className="text-muted-foreground mt-1">Files, links, notes, and assignments shared in this class</p>
        </div>
        {(isEnrolled || isInstructor) && (
          <ButtonLink href={`/app/classes/${slug}/materials/new`} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Material
          </ButtonLink>
        )}
      </div>

      {/* Materials Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {materials?.length ? (
          materials.map((material) => {
            const author = Array.isArray(material.profiles) ? material.profiles[0] : material.profiles;
            const Icon = typeIcons[material.type as keyof typeof typeIcons] || FileText;
            const isAssignment = material.type === "flashcard_set" && material.metadata?.assignment_details;
            
            return (
              <Card key={material.id} className={isAssignment ? "border-orange-200 bg-orange-50" : ""}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${typeColors[material.type as keyof typeof typeColors] || "bg-gray-100 text-gray-700"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{material.title}</CardTitle>
                      <Badge variant="secondary" className={`text-xs ${typeColors[material.type as keyof typeof typeColors] || ""}`}>
                        {typeLabels[material.type as keyof typeof typeLabels] || material.type}
                        {isAssignment && " • Assignment"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ButtonLink href={`/app/classes/${slug}/materials/${material.id}`} variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </ButtonLink>
                    {material.url && (
                      <a href={material.url} target="_blank" rel="noopener noreferrer">
                        <ButtonLink variant="ghost" size="icon" href={material.url}>
                          <LinkIcon className="h-4 w-4" />
                        </ButtonLink>
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {material.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{material.description}</p>
                  )}
                  {isAssignment && material.metadata && (
                    <div className="border-t pt-3 space-y-2">
                      {material.metadata.due_date && (
                        <div className="flex items-center gap-2 text-sm text-orange-600">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {format(new Date(material.metadata.due_date), "MMM d, yyyy")}</span>
                        </div>
                      )}
                      {material.metadata.points_possible && (
                        <div className="text-sm text-muted-foreground">
                          Points: {material.metadata.points_possible}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={author?.avatar_url} alt={author?.display_name} />
                        <AvatarFallback>{author?.display_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                      <span>{author?.display_name}</span>
                      <span>•</span>
                      <span>{format(new Date(material.created_at), "MMM d, yyyy")}</span>
                    </div>
                    {material.storage_path && (
                      <ButtonLink href={`/app/classes/${slug}/materials/${material.id}/download`} variant="ghost" size="sm" className="gap-1">
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </ButtonLink>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No materials yet</h3>
                <p className="text-muted-foreground mt-2">
                  {isEnrolled || isInstructor 
                    ? "Add your first study material to share with the class"
                    : "Enroll in this class to access materials"}
                </p>
                {(isEnrolled || isInstructor) && (
                  <ButtonLink href={`/app/classes/${slug}/materials/new`} className="mt-4 inline-flex gap-2">
                    <Plus className="h-4 w-4" />
                    Add Material
                  </ButtonLink>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}