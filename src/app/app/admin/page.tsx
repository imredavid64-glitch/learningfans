import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { getDbUsageReport } from "@/lib/archive";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Users, TrendingUp, Database, Settings, Shield, Plus, Search, MoreVertical, Building2 } from "lucide-react";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) {
    return <div className="p-12 text-center"><p className="text-muted-foreground">Unauthorized — admin access required.</p></div>;
  }

  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: totalSpaces } = await supabase
    .from("spaces")
    .select("*", { count: "exact", head: true });

  const [usage, tableSizes] = await Promise.all([
    getDbUsageReport(),
    supabase
      .rpc("get_table_sizes")
      .then(({ data }) =>
        ((data ?? []) as { table_name: string; size_bytes: number; row_count: number }[]),
      ),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, spaces, and system settings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalUsers || 0}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSpaces || 0}</p>
              <p className="text-sm text-muted-foreground">Spaces/Classes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {usage.totalBytes ? formatBytes(usage.totalBytes) : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                DB usage · {(usage.usagePercent * 100).toFixed(1)}% of 500 MB
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users?.filter(u => u.role === "admin").length || 0} Admins
              </p>
              <p className="text-sm text-muted-foreground">
                {users?.filter(u => u.role === "moderator").length || 0} Moderators
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database health */}
      <Card>
        <CardHeader>
          <CardTitle>Database health</CardTitle>
          <CardDescription>
            Free-tier budget (500 MB database) — daily retention + archival keep it in check
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Database usage</span>
              <span className="text-muted-foreground">
                {formatBytes(usage.totalBytes)} of 500 MB ·{" "}
                {(usage.usagePercent * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={"h-full rounded-full " + (
                  usage.usagePercent >= 0.8
                    ? "bg-red-500"
                    : usage.usagePercent >= 0.6
                      ? "bg-amber-500"
                      : "bg-green-500"
                )}
                style={{ width: `${Math.min(100, usage.usagePercent * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant={usage.archiveConfigured ? "default" : "destructive"}>
              {usage.archiveConfigured ? "Archive DB connected" : "Archive DB not configured"}
            </Badge>
            {usage.archiveConfigured && (
              <span className="text-muted-foreground">
                {usage.archiveCount.toLocaleString()} records archived
              </span>
            )}
            {usage.needsArchive && !usage.archiveConfigured && (
              <span className="font-medium text-red-600">
                Over 80% used with no archive — old rows are NOT being archived
              </span>
            )}
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              • Daily cron archives moderation logs (30d) and chat history (90d) to the
              archive project, then deletes from main.
            </li>
            <li>
              • Daily cron prunes consumed moderation-queue rows (7d), read notifications
              (30d), and sent meeting reminders (30d).
            </li>
          </ul>

          {tableSizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Largest tables</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-2.5 font-medium">Table</th>
                      <th className="p-2.5 font-medium">Size</th>
                      <th className="p-2.5 font-medium">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableSizes.slice(0, 8).map((t) => (
                      <tr key={t.table_name} className="border-b last:border-0">
                        <td className="p-2.5 font-mono text-xs">{t.table_name}</td>
                        <td className="p-2.5">{formatBytes(t.size_bytes)}</td>
                        <td className="p-2.5 tabular-nums">{t.row_count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage all platform users</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-input bg-background rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Storage</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {user.avatar_url ? (
                            <Image src={user.avatar_url} alt="" width={64} height={64} className="h-8 w-8 rounded-full" />
                          ) : (
                            <span className="text-primary font-medium">{user.display_name?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <span className="font-medium">{user.display_name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={
                        user.role === "admin" ? "default" :
                        user.role === "moderator" ? "secondary" : "outline"
                      }>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">{user.email || "—"}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {(Number(user.storage_used_bytes || 0) / 1024 / 1024).toFixed(2)} MB
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <select 
                          defaultValue={user.role}
                          className="border border-input bg-background rounded-md py-1 px-2 text-sm"
                        >
                          <option value="student">Student</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!users || users.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">Disable access for non-admin users</p>
              </div>
              <Button variant="outline" size="sm">Enable</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New User Registration</p>
                <p className="text-sm text-muted-foreground">Allow new users to sign up</p>
              </div>
              <Button variant="outline" size="sm">Enabled</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AI Moderation</p>
                <p className="text-sm text-muted-foreground">Automatically flag inappropriate content</p>
              </div>
              <Button variant="outline" size="sm">Enabled</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/app/admin/schools" className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-border bg-background bg-clip-padding px-2.5 h-8 gap-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground">
              <Building2 className="h-4 w-4" />
              Manage Schools
            </Link>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Plus className="h-4 w-4" />
              Create Announcement
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Database className="h-4 w-4" />
              Database Backup
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Users className="h-4 w-4" />
              Invite Moderator
            </Button>
            <Button variant="destructive" className="w-full justify-start gap-2">
              <Shield className="h-4 w-4" />
              Emergency Lockdown
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}