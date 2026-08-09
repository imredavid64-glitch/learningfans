import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProject, waitForProjectReady, getProjectApiKeys, runSqlBatch, updateProjectAuthSettings } from "@/lib/supabase-mgmt";

type School = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: string;
  owner_id: string | null;
  supabase_project_ref: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  supabase_service_role_key: string | null;
  region: string;
  plan: string;
  ai_agent_enabled: boolean;
  last_health_check_at: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_REGION = "us-east-1";

const SCHEMA_SQL = `create type public.profile_role as enum ('student', 'moderator', 'admin');
create type public.space_member_role as enum ('member', 'moderator');
create type public.material_type as enum ('file', 'link', 'note', 'flashcard_set');
create type public.material_priority as enum ('urgent', 'high', 'normal', 'low');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.report_target_type as enum ('thread', 'post', 'material', 'profile');
create type public.sanction_type as enum ('warn', 'mute', 'suspend');
create type public.event_visibility as enum ('private', 'space');
create type public.attendee_status as enum ('going', 'maybe');
create type public.meeting_status as enum ('scheduled', 'live', 'completed', 'cancelled');
create table public.profiles (id uuid primary key references auth.users (id) on delete cascade, display_name text not null, avatar_url text, role public.profile_role not null default 'student', storage_used_bytes bigint not null default 0, created_at timestamptz not null default now());
create table public.spaces (id uuid primary key default gen_random_uuid(), name text not null, description text, slug text not null unique, is_public boolean not null default false, created_by uuid not null references public.profiles (id) on delete cascade, created_at timestamptz not null default now());
create table public.space_members (space_id uuid not null references public.spaces (id) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade, role public.space_member_role not null default 'member', joined_at timestamptz not null default now(), primary key (space_id, user_id));
create table public.threads (id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces (id) on delete cascade, author_id uuid not null references public.profiles (id) on delete cascade, title text not null, body text not null default '', is_pinned boolean not null default false, is_locked boolean not null default false, is_hidden boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.posts (id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.threads (id) on delete cascade, author_id uuid not null references public.profiles (id) on delete cascade, body text not null, is_hidden boolean not null default false, created_at timestamptz not null default now());
create table public.reactions (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts (id) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade, created_at timestamptz not null default now(), unique (post_id, user_id));
create table public.tags (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
create table public.study_materials (id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces (id) on delete cascade, author_id uuid not null references public.profiles (id) on delete cascade, type public.material_type not null, title text not null, description text, url text, storage_path text, metadata jsonb not null default '{}', community_score int not null default 0, is_hidden boolean not null default false, created_at timestamptz not null default now());
create table public.material_upvotes (material_id uuid not null references public.study_materials (id) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade, created_at timestamptz not null default now(), primary key (material_id, user_id));
create table public.material_priorities (material_id uuid not null references public.study_materials (id) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade, priority public.material_priority not null default 'normal', due_at timestamptz, notes text, updated_at timestamptz not null default now(), primary key (material_id, user_id));
create table public.material_tags (material_id uuid not null references public.study_materials (id) on delete cascade, tag_id uuid not null references public.tags (id) on delete cascade, primary key (material_id, tag_id));
create table public.schedule_events (id uuid primary key default gen_random_uuid(), title text not null, description text, starts_at timestamptz not null, ends_at timestamptz not null, all_day boolean not null default false, timezone text not null default 'UTC', owner_id uuid references public.profiles (id) on delete cascade, space_id uuid references public.spaces (id) on delete cascade, visibility public.event_visibility not null default 'private', linked_material_id uuid references public.study_materials (id) on delete set null, created_at timestamptz not null default now());
create table public.event_attendees (event_id uuid not null references public.schedule_events (id) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade, status public.attendee_status not null default 'going', primary key (event_id, user_id));
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles (id) on delete cascade, target_type public.report_target_type not null, target_id uuid not null, reason text not null, status public.report_status not null default 'open', created_at timestamptz not null default now());
create table public.moderation_actions (id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles (id) on delete cascade, action text not null, target_type text not null, target_id uuid not null, note text, created_at timestamptz not null default now());
create table public.user_sanctions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles (id) on delete cascade, type public.sanction_type not null, expires_at timestamptz, reason text not null, created_by uuid not null references public.profiles (id) on delete cascade, created_at timestamptz not null default now());
create table public.storage_objects (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles (id) on delete cascade, bucket text not null, path text not null, size_bytes bigint not null, created_at timestamptz not null default now(), unique (bucket, path));
create table public.grades (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles (id) on delete cascade, assignment_id uuid not null references public.study_materials (id) on delete cascade, score numeric(5,2) not null, letter_grade varchar(2), submitted_at timestamptz not null default now(), graded_at timestamptz, graded_by uuid references public.profiles (id) on delete set null, feedback text, unique (student_id, assignment_id));
create table public.audit_log (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles (id) on delete cascade, action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table public.meetings (id uuid primary key default gen_random_uuid(), space_id uuid references public.spaces (id) on delete cascade, organizer_id uuid not null references public.profiles (id) on delete cascade, title text not null, description text, call_url text, starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null default 'UTC', status public.meeting_status not null default 'scheduled', reminder_sent boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.meeting_participants (meeting_id uuid not null references public.meetings (id) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade, rsvp_status text not null default 'pending', invited_at timestamptz not null default now(), primary key (meeting_id, user_id));
create table public.meeting_reminders (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.meetings (id) on delete cascade, recipient_id uuid not null references public.profiles (id) on delete cascade, reminder_text text not null, scheduled_for timestamptz not null, sent_at timestamptz, created_at timestamptz not null default now());
`;

const RLS_SQL = `
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.tags enable row level security;
alter table public.study_materials enable row level security;
alter table public.material_upvotes enable row level security;
alter table public.material_priorities enable row level security;
alter table public.material_tags enable row level security;
alter table public.schedule_events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.user_sanctions enable row level security;
alter table public.storage_objects enable row level security;
alter table public.audit_log enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_reminders enable row level security;
`;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function provisionSchool(
  name: string,
  adminEmail: string,
  organizationId: string,
): Promise<School> {
  const slug = slugify(name);
  const subdomain = slug;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("schools")
    .select("id")
    .or(`slug.eq.${slug},subdomain.eq.${subdomain}`)
    .maybeSingle();

  if (existing) {
    throw new Error(`School "${name}" already exists (slug or subdomain conflict)`);
  }

  const { data: school, error: insertError } = await supabase
    .from("schools")
    .insert({
      name,
      slug,
      subdomain,
      status: "provisioning",
      region: DEFAULT_REGION,
    })
    .select()
    .single();

  if (insertError || !school) {
    throw new Error(`Failed to create school record: ${insertError?.message}`);
  }

  try {
    const project = await createProject(`${name} - LearningFans`, organizationId, DEFAULT_REGION);
    const projectRef = project.ref as string;

    await waitForProjectReady(projectRef);
    const { anonKey, serviceRoleKey } = await getProjectApiKeys(projectRef);

    const schemaStatements = SCHEMA_SQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s + ";");
    await runSqlBatch(projectRef, schemaStatements);

    const rlsStatements = RLS_SQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s + ";");
    await runSqlBatch(projectRef, rlsStatements);

    await updateProjectAuthSettings(projectRef, {
      site_url: `https://learningfans.vercel.app`,
      disable_signup: false,
    });

    const { error: updateError } = await supabase
      .from("schools")
      .update({
        status: "active",
        supabase_project_ref: projectRef,
        supabase_url: `https://${projectRef}.supabase.co`,
        supabase_anon_key: anonKey,
        supabase_service_role_key: serviceRoleKey,
      })
      .eq("id", school.id);

    if (updateError) {
      throw new Error(`Failed to update school with credentials: ${updateError.message}`);
    }

    const { data: updated } = await supabase
      .from("schools")
      .select("*")
      .eq("id", school.id)
      .single();

    return updated as School;
  } catch (err) {
    await supabase.from("schools").update({ status: "error" }).eq("id", school.id);
    throw err;
  }
}

export async function getSchools(): Promise<School[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
  return (data as School[]) || [];
}

export async function getSchool(id: string): Promise<School | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("*").eq("id", id).single();
  return data as School | null;
}

export async function getSchoolClient(schoolId: string) {
  const school = await getSchool(schoolId);
  if (!school?.supabase_url || !school.supabase_service_role_key) {
    throw new Error("School not provisioned");
  }
  return createAdminClient(school.supabase_url, school.supabase_service_role_key);
}

export async function deleteSchool(schoolId: string): Promise<void> {
  const supabase = await createClient();
  const school = await getSchool(schoolId);
  if (!school) throw new Error("School not found");

  if (school.supabase_project_ref) {
    try {
      const { getProject } = await import("@/lib/supabase-mgmt");
      await getProject(school.supabase_project_ref);
    } catch {
      // Project may already be deleted
    }
  }

  await supabase.from("schools").delete().eq("id", schoolId);
}

export async function checkSchoolHealth(schoolId: string): Promise<{ healthy: boolean; error?: string }> {
  try {
    const school = await getSchool(schoolId);
    if (!school?.supabase_url || !school.supabase_service_role_key) {
      return { healthy: false, error: "Not provisioned" };
    }
    const admin = createAdminClient(school.supabase_url, school.supabase_service_role_key);
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (error) return { healthy: false, error: error.message };

    const supabase = await createClient();
    await supabase.from("schools").update({ last_health_check_at: new Date().toISOString() }).eq("id", schoolId);
    return { healthy: true };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
