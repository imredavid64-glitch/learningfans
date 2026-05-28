import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { updateUserRoleFromForm } from "@/actions/admin";
import { USER_STORAGE_QUOTA_BYTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile!.role)) redirect("/app");

  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const totalStorage =
    users?.reduce((sum, u) => sum + Number(u.storage_used_bytes), 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground">
          Manage roles and monitor platform storage (1 GB Supabase cap).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracked storage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(totalStorage / 1024 / 1024).toFixed(1)} MB
            </p>
            <CardDescription>Of ~1024 MB project limit</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-user quota</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {USER_STORAGE_QUOTA_BYTES / 1024 / 1024} MB
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update user role</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateUserRoleFromForm} className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" name="userId" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="student">Student</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" className="self-end">
              Update role
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Users</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-3">Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Storage</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="p-3">{u.display_name}</td>
                  <td className="p-3">
                    <Badge>{u.role}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {(Number(u.storage_used_bytes) / 1024 / 1024).toFixed(2)} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
