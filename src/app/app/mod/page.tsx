import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isModerator, isAdmin } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { 
  Flag, 
  Shield, 
  UserX, 
  AlertCircle, 
  CheckCircle2, 
  Eye,
  AlertTriangle,
  MoreVertical,
  Search,
  Filter
} from "lucide-react";

export default async function ModerationPage() {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) redirect("/app");

  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select(`
      *,
      profiles!inner(display_name, avatar_url, role)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: sanctions } = await supabase
    .from("user_sanctions")
    .select(`
      *,
      profiles!inner(display_name, avatar_url),
      created_by_profile:profiles!user_sanctions_created_by_fkey(display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const isAdminUser = isAdmin(profile?.role);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Moderation Dashboard</h1>
          <p className="text-muted-foreground">
            Manage reports, sanctions, and community safety
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Flag className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports?.filter(r => r.status === "open").length || 0}</p>
              <p className="text-sm text-muted-foreground">Open Reports</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports?.filter(r => r.status === "reviewing").length || 0}</p>
              <p className="text-sm text-muted-foreground">Under Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports?.filter(r => r.status === "resolved").length || 0}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <UserX className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {sanctions?.filter(s => s.type === "suspend" && (!s.expires_at || new Date(s.expires_at) > new Date())).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Active Suspensions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="reports">
            <Flag className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="sanctions">
            <Shield className="h-4 w-4 mr-2" />
            Sanctions
          </TabsTrigger>
          <TabsTrigger value="mod-log">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Mod Log
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Reports</CardTitle>
              <CardDescription>Review and act on user-submitted reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reports?.length ? (
                  reports.map((report) => {
                    const reporter = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles;
                    return (
                      <div key={report.id} className="p-4 border rounded-lg bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge 
                                variant={report.status === "open" ? "destructive" : 
                                         report.status === "reviewing" ? "secondary" : 
                                         report.status === "resolved" ? "default" : "outline"}
                              >
                                {report.status}
                              </Badge>
                              <Badge variant="outline">{report.target_type}</Badge>
                              <span className="text-sm text-muted-foreground">
                                Reported by {reporter?.display_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm">{report.reason}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button 
                            size="sm" 
                            variant={report.status !== "resolved" ? "default" : "outline"}
                            disabled={report.status === "resolved"}
                          >
                            Mark Resolved
                          </Button>
                          <Button size="sm" variant="outline">
                            Dismiss
                          </Button>
                          <Button size="sm" variant="destructive">
                            Take Action
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <Flag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No reports</p>
                    <p className="text-muted-foreground mt-2">All clear! No reports to review.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sanctions Tab */}
        <TabsContent value="sanctions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Sanctions</CardTitle>
                  <CardDescription>View and manage user sanctions</CardDescription>
                </div>
                {isAdminUser && (
                  <Button className="gap-2">
                    <UserX className="h-4 w-4" />
                    Create Sanction
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="p-3">User</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Expires</th>
                      <th className="p-3">Issued By</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sanctions?.map((sanction) => {
                      const user = Array.isArray(sanction.profiles) ? sanction.profiles[0] : sanction.profiles;
                      const issuer = Array.isArray(sanction.created_by_profile) ? sanction.created_by_profile[0] : sanction.created_by_profile;
                      return (
                        <tr key={sanction.id} className="border-b">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                {user?.avatar_url ? (
                                  <Image src={user.avatar_url} alt="" width={64} height={64} className="h-8 w-8 rounded-full" />
                                ) : (
                                  <span className="text-primary font-medium">{user?.display_name?.[0]?.toUpperCase()}</span>
                                )}
                              </div>
                              <span className="font-medium">{user?.display_name}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={sanction.type === "suspend" ? "destructive" : sanction.type === "mute" ? "secondary" : "default"}>
                              {sanction.type}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm max-w-xs truncate">{sanction.reason}</td>
                          <td className="p-3 text-sm">
                            {sanction.expires_at ? format(new Date(sanction.expires_at), "MMM d, yyyy") : "Permanent"}
                          </td>
                          <td className="p-3 text-sm">{issuer?.display_name || "System"}</td>
                          <td className="p-3 text-sm text-muted-foreground">{format(new Date(sanction.created_at), "MMM d, yyyy")}</td>
                        </tr>
                      );
                    })}
                    {(!sanctions || sanctions.length === 0) && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-muted-foreground">No sanctions recorded</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mod Log Tab */}
        <TabsContent value="mod-log" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moderation Log</CardTitle>
              <CardDescription>All moderation actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <p className="text-center text-muted-foreground">Moderation log coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}