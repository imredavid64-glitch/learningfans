import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccountabilityGroups } from "@/components/accountability/accountability-groups";
import type { GroupCheckin } from "@/lib/accountability";

export default async function GroupsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  let groups: {
    id: string;
    name: string;
    weekly_goal: string;
    created_by: string;
    created_at: string;
    members: { user_id: string; display_name: string }[];
    checkins: GroupCheckin[];
  }[] = [];

  try {
    const { data: groupRows } = await supabase
      .from("accountability_groups")
      .select("id, name, weekly_goal, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const ids = (groupRows ?? []).map((g) => g.id);
    if (ids.length > 0) {
      const [{ data: memberRows }, { data: checkinRows }] = await Promise.all([
        supabase
          .from("accountability_group_members")
          .select("group_id, user_id, profiles(display_name)")
          .in("group_id", ids),
        supabase
          .from("accountability_checkins")
          .select("group_id, user_id, checkin_date")
          .in("group_id", ids)
          .gte("checkin_date", new Date(new Date().getTime() - 8 * 86_400_000).toISOString().slice(0, 10)),
      ]);

      groups = (groupRows ?? []).map((g) => {
        const members = (memberRows ?? [])
          .filter((m) => m.group_id === g.id)
          .map((m) => {
            const raw = m.profiles as { display_name: string } | { display_name: string }[] | null;
            const p = (Array.isArray(raw) ? raw[0] : raw) as { display_name: string } | null;
            return { user_id: m.user_id, display_name: p?.display_name ?? "Unknown" };
          });
        const checkins = (checkinRows ?? [])
          .filter((c) => c.group_id === g.id)
          .map((c) => ({ user_id: c.user_id, checkin_date: c.checkin_date as string }));
        return { ...g, members, checkins };
      });
    }
  } catch {
    groups = [];
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accountability groups</h1>
        <p className="text-muted-foreground">
          Small groups with a shared weekly goal. Check in daily, nudge each other, and keep the streak alive.
        </p>
      </div>

      <AccountabilityGroups
        userId={profile!.id}
        groups={groups}
        now={now.toISOString()}
      />
    </div>
  );
}
