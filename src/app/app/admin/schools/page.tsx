import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { createSchool, deleteSchool, checkSchoolsHealth, runAIAnalysis } from "@/actions/schools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Globe, Shield, Database, Plus, RefreshCw, Sparkles } from "lucide-react";

export default async function SchoolsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) {
    return <div className="p-12 text-center"><p className="text-muted-foreground">Unauthorized — admin access required.</p></div>;
  }

  const supabase = await createClient();
  const { success, error } = await searchParams;

  const { data: schools } = await supabase
    .from("schools")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schools</h1>
          <p className="text-muted-foreground">Manage multi-tenant school databases</p>
        </div>
      </div>

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Provision New School
          </CardTitle>
          <CardDescription>
            Creates a new isolated Supabase project with its own database, API keys, and AI agent monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSchool} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="name">School Name</Label>
                <Input id="name" name="name" placeholder="e.g. Springfield High" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email</Label>
                <Input id="adminEmail" name="adminEmail" type="email" placeholder="admin@school.edu" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationId">Supabase Org ID</Label>
                <Input
                  id="organizationId"
                  name="organizationId"
                  placeholder="Org ID from Supabase"
                  defaultValue="zvzlxmutaustgbdbwcvy"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a new Supabase Free Tier project with full schema, RLS policies, and auth settings.
              The Gemini AI agent automatically configures security monitoring.
            </p>
            <Button type="submit" className="gap-2">
              <Database className="h-4 w-4" />
              Provision School
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Schools</CardTitle>
            <CardDescription>{schools?.length || 0} schools provisioned</CardDescription>
          </div>
          <div className="flex gap-2">
            <form action={checkSchoolsHealth}>
              <Button variant="outline" type="submit" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Health Check
              </Button>
            </form>
            <form action={runAIAnalysis}>
              <Button variant="outline" type="submit" className="gap-2">
                <Sparkles className="h-4 w-4" />
                AI Security Scan
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(!schools || schools.length === 0) ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No schools provisioned yet.</p>
              <p className="text-sm">Use the form above to create your first school.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-3">School</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Database</th>
                    <th className="p-3">AI Agent</th>
                    <th className="p-3">Last Check</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.id} className="border-b">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-medium">{school.name}</span>
                            <p className="text-xs text-muted-foreground">{school.subdomain}.learningfans.vercel.app</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            school.status === "active"
                              ? "default"
                              : school.status === "provisioning"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {school.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {school.supabase_project_ref ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Database className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs">{school.supabase_project_ref.substring(0, 12)}...</code>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Pending</span>
                        )}
                      </td>
                      <td className="p-3">
                        {school.ai_agent_enabled ? (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            <Shield className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Disabled</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {school.last_health_check_at
                          ? new Date(school.last_health_check_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(school.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <form action={deleteSchool}>
                            <input type="hidden" name="schoolId" value={school.id} />
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                              Delete
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4" />
              Multi-Tenant Architecture
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each school gets its own Supabase project with isolated database, auth, and API keys.
            Cross-tenant data access is prevented by design at the infrastructure level.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4" />
              AI Security Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The Gemini AI agent continuously monitors all school databases for anomalies,
            suspicious activity patterns, and security risks via automated health checks.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              Free Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each school starts on Supabase Free Tier (500 MB database, 5 GB bandwidth).
            Upgrade individual schools as they grow, without affecting others.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
