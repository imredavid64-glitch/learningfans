import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Calendar, User, Database } from "lucide-react";
import { StudyHubData } from "./study-hub-data";

export default function StudyHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Hub</h1>
          <p className="text-muted-foreground">Your academic command center</p>
        </div>
        <div className="flex gap-2">
          <a
            href="https://study-hub-plum-omega.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open Study Hub
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            View your Study Hub profile, subjects, and study targets synced from the app.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Schedule & Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Upcoming calendar events, planner goals, and Kanban tasks from Study Hub.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              Cloud Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Data is synced from Study Hub via Supabase. Open Study Hub to trigger a sync.
          </CardContent>
        </Card>
      </div>

      <StudyHubData />
    </div>
  );
}
