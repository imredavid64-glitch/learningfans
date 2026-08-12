import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ClipboardList, ListOrdered, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type RadarKind = "priority" | "event" | "assignment" | "meeting";

interface RadarItem {
  kind: RadarKind;
  title: string;
  dueAt: string;
  spaceName?: string;
  detail?: string;
  href: string;
}

const KIND_ICONS: Record<RadarKind, typeof ListOrdered> = {
  priority: ListOrdered,
  event: Calendar,
  assignment: ClipboardList,
  meeting: Video,
};

const KIND_LABELS: Record<RadarKind, string> = {
  priority: "Priority",
  event: "Event",
  assignment: "Assignment",
  meeting: "Meeting",
};

function urgency(dueAt: string): { label: string; className: string } {
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const hours = (due - now) / 3_600_000;
  if (due < now) return { label: "Overdue", className: "bg-destructive/10 text-destructive" };
  if (hours <= 24) return { label: "Today", className: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (hours <= 72) return { label: "In 2 days", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (hours <= 168) return { label: "This week", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  return { label: format(new Date(dueAt), "MMM d"), className: "bg-muted text-muted-foreground" };
}

function dueIn(dueAt: string): string {
  const due = new Date(dueAt).getTime();
  const diff = due - Date.now();
  if (diff <= 0) return "due now";
  const hours = diff / 3_600_000;
  if (hours < 1) return `in ${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `in ${Math.round(hours)}h`;
  if (hours < 48) return "tomorrow";
  return `in ${Math.round(hours / 24)}d`;
}

export async function DeadlineRadar() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const items: RadarItem[] = [];

  // 1. Prioritized materials with due dates
  const { data: priorities } = await supabase
    .from("material_priorities")
    .select("priority, due_at, study_materials(id, title, space_id, spaces(slug, name))")
    .eq("user_id", profile.id)
    .not("due_at", "is", null)
    .order("due_at", { ascending: true })
    .limit(15);

  for (const p of priorities ?? []) {
    const raw = p.study_materials;
    const material = (Array.isArray(raw) ? raw[0] : raw) as
      | { id: string; title: string; spaces: { slug: string; name: string } | { slug: string; name: string }[] | null }
      | null;
    if (!material || !p.due_at) continue;
    const space = Array.isArray(material.spaces) ? material.spaces[0] : material.spaces;
    items.push({
      kind: "priority",
      title: material.title,
      dueAt: p.due_at,
      spaceName: space?.name,
      detail: String(p.priority),
      href: `/app/classes/${space?.slug ?? "unknown"}/materials/${material.id}`,
    });
  }

  // 2. Schedule events (personal + space)
  const { data: events } = await supabase
    .from("schedule_events")
    .select("id, title, starts_at, spaces(slug, name)")
    .or(`owner_id.eq.${profile.id},visibility.eq.space`)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(15);

  for (const e of events ?? []) {
    const space = Array.isArray(e.spaces) ? e.spaces[0] : e.spaces;
    items.push({
      kind: "event",
      title: e.title,
      dueAt: e.starts_at,
      spaceName: space?.name,
      href: "/app/schedule",
    });
  }

  // 3. Assignments with due dates, in the user's spaces
  const { data: memberships } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", profile.id);

  const spaceIds = (memberships ?? []).map((m) => m.space_id);
  if (spaceIds.length > 0) {
    const { data: assignments } = await supabase
      .from("study_materials")
      .select("id, title, space_id, spaces(slug, name), metadata")
      .in("space_id", spaceIds)
      .eq("type", "flashcard_set")
      .contains("metadata", { assignment_details: true })
      .limit(50);

    for (const a of assignments ?? []) {
      const meta = a.metadata as { due_date?: string } | null;
      if (!meta?.due_date) continue;
      const space = Array.isArray(a.spaces) ? a.spaces[0] : a.spaces;
      items.push({
        kind: "assignment",
        title: a.title,
        dueAt: meta.due_date,
        spaceName: space?.name,
        href: `/app/classes/${space?.slug ?? "unknown"}/grades`,
      });
    }
  }

  // 4. Meetings (organized or RSVP'd)
  const { data: organized } = await supabase
    .from("meetings")
    .select("id, title, starts_at, spaces(slug, name)")
    .eq("organizer_id", profile.id)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(10);

  const { data: rsvps } = await supabase
    .from("meeting_participants")
    .select("meeting_id, meetings!inner(id, title, starts_at, spaces(slug, name))")
    .eq("user_id", profile.id)
    .gte("meetings.starts_at", now)
    .limit(10);

  const seenMeetingIds = new Set<string>();
  for (const m of organized ?? []) {
    if (seenMeetingIds.has(m.id)) continue;
    seenMeetingIds.add(m.id);
    const space = Array.isArray(m.spaces) ? m.spaces[0] : m.spaces;
    items.push({
      kind: "meeting",
      title: m.title,
      dueAt: m.starts_at,
      spaceName: space?.name,
      href: `/app/meetings/${m.id}`,
    });
  }
  for (const r of rsvps ?? []) {
    const list = Array.isArray(r.meetings) ? r.meetings : [r.meetings].filter(Boolean);
    const m = list[0] as
      | { id: string; title: string; starts_at: string; spaces: { slug: string; name: string } | { slug: string; name: string }[] | null }
      | undefined;
    if (!m || seenMeetingIds.has(m.id)) continue;
    seenMeetingIds.add(m.id);
    const space = Array.isArray(m.spaces) ? m.spaces[0] : m.spaces;
    items.push({
      kind: "meeting",
      title: m.title,
      dueAt: m.starts_at,
      spaceName: space?.name,
      href: `/app/meetings/${m.id}`,
    });
  }

  items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const top = items.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">Deadline Radar</CardTitle>
        <CardDescription>
          Everything due, in one place — priorities, events, assignments, and meetings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing on your radar. Set due dates on priorities or schedule events to see them here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              const urgencyBadge = urgency(item.dueAt);
              return (
                <li key={`${item.kind}-${item.title}-${item.dueAt}`}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {KIND_LABELS[item.kind]}
                        {item.spaceName ? ` · ${item.spaceName}` : ""}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <Badge variant="secondary" className={cn("gap-1", urgencyBadge.className)}>
                        {urgencyBadge.label}
                      </Badge>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{dueIn(item.dueAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
