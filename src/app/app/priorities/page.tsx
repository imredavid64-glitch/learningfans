import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PrioritiesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: rankings } = await supabase
    .from("user_material_rankings")
    .select("*")
    .eq("user_id", profile!.id)
    .order("rank_score", { ascending: false });

  const { data: spaces } = await supabase.from("spaces").select("id, slug, name");

  const spaceMap = new Map(spaces?.map((s) => [s.id, s]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Priority board</h1>
        <p className="text-muted-foreground">
          Your study materials ranked by urgency, due dates, and community upvotes.
        </p>
      </div>

      <div className="space-y-3">
        {rankings?.map((r, i) => {
          const space = spaceMap.get(r.space_id);
          return (
            <Card key={r.material_id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      <span className="mr-2 text-muted-foreground">#{i + 1}</span>
                      {r.title}
                    </CardTitle>
                    <CardDescription>
                      {space ? (
                        <Link
                          href={`/app/spaces/${space.slug}/materials`}
                          className="hover:underline"
                        >
                          {space.name}
                        </Link>
                      ) : (
                        "Unknown space"
                      )}{" "}
                      · Score {Number(r.rank_score).toFixed(1)}
                    </CardDescription>
                  </div>
                  <Badge>{r.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{r.type.replace("_", " ")}</Badge>
                <Badge variant="secondary">{r.community_score} upvotes</Badge>
                {r.due_at && (
                  <span>Due {format(new Date(r.due_at), "MMM d, yyyy")}</span>
                )}
                {r.notes && <span className="italic">{r.notes}</span>}
              </CardContent>
            </Card>
          );
        })}
        {!rankings?.length && (
          <p className="text-muted-foreground">
            No prioritized materials yet. Open a space, add materials, and set a
            priority from the materials list.
          </p>
        )}
      </div>
    </div>
  );
}
