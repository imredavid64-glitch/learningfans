import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator } from "@/lib/auth";
import {
  updateReportStatus,
  createSanction,
  hideMaterial,
} from "@/actions/moderation";
import { hideThread } from "@/actions/discussion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReportStatus } from "@/lib/constants";

export default async function ModPage() {
  const profile = await getCurrentProfile();
  if (!isModerator(profile!.role)) redirect("/app");

  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("*, profiles!reports_reporter_id_fkey(display_name)")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false });

  const { data: actions } = await supabase
    .from("moderation_actions")
    .select("*, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Moderation queue</h1>
        <p className="text-muted-foreground">
          Review reports and take action on flagged content.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Open reports</h2>
        {reports?.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {r.target_type} · {r.target_id.slice(0, 8)}…
                </CardTitle>
                <Badge>{r.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{r.reason}</p>
              <p className="text-xs text-muted-foreground">
                By {(r.profiles as { display_name: string })?.display_name} ·{" "}
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["reviewing", "resolved", "dismissed"] as ReportStatus[]).map(
                  (status) => (
                    <form
                      key={status}
                      action={updateReportStatus.bind(null, r.id, status)}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        {status}
                      </Button>
                    </form>
                  ),
                )}
                {r.target_type === "thread" && (
                  <form action={hideThread.bind(null, r.target_id, "")}>
                    <Button type="submit" size="sm" variant="destructive">
                      Hide thread
                    </Button>
                  </form>
                )}
                {r.target_type === "material" && (
                  <form action={hideMaterial.bind(null, r.target_id)}>
                    <Button type="submit" size="sm" variant="destructive">
                      Hide material
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!reports?.length && (
          <p className="text-sm text-muted-foreground">No open reports.</p>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Issue sanction</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSanction} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" name="userId" required placeholder="UUID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="warn">Warn</option>
                <option value="mute">Mute</option>
                <option value="suspend">Suspend</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="datetime-local" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" required rows={2} />
            </div>
            <Button type="submit" className="w-fit">
              Apply sanction
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent actions</h2>
        <ul className="space-y-2 text-sm">
          {actions?.map((a) => (
            <li key={a.id} className="rounded-md border border-border px-3 py-2">
              <span className="font-medium">
                {(a.profiles as { display_name: string })?.display_name}
              </span>{" "}
              — {a.action} on {a.target_type}{" "}
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
