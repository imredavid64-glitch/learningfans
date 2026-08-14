-- LearningFans: Accountability groups
-- Small groups with a shared weekly goal. Members check in daily; the group
-- shows per-member progress and a shared streak. Peer nudges go through the
-- existing notification bell.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table if not exists public.accountability_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  weekly_goal text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.accountability_group_members (
  group_id uuid not null references public.accountability_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.accountability_checkins (
  group_id uuid not null references public.accountability_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkin_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id, checkin_date)
);

create table if not exists public.accountability_nudges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.accountability_groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_accountability_members_group on public.accountability_group_members (group_id);
create index if not exists idx_accountability_members_user on public.accountability_group_members (user_id);
create index if not exists idx_accountability_checkins_group on public.accountability_checkins (group_id, checkin_date);
create index if not exists idx_accountability_nudges_to on public.accountability_nudges (to_user, created_at desc);

alter table public.accountability_groups enable row level security;
alter table public.accountability_group_members enable row level security;
alter table public.accountability_checkins enable row level security;
alter table public.accountability_nudges enable row level security;

-- Groups are browsable by any authenticated user (small-community scale).
drop policy if exists "Groups browsable" on public.accountability_groups;
create policy "Groups browsable"
  on public.accountability_groups for select to authenticated using (true);

drop policy if exists "Users create groups" on public.accountability_groups;
create policy "Users create groups"
  on public.accountability_groups for insert to authenticated
  with check (auth.uid() = created_by and not public.is_suspended());

drop policy if exists "Creator deletes group" on public.accountability_groups;
create policy "Creator deletes group"
  on public.accountability_groups for delete to authenticated
  using (created_by = auth.uid() or public.is_app_moderator());

-- Membership
drop policy if exists "Memberships visible" on public.accountability_group_members;
create policy "Memberships visible"
  on public.accountability_group_members for select to authenticated using (true);

drop policy if exists "Users join groups" on public.accountability_group_members;
create policy "Users join groups"
  on public.accountability_group_members for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users leave groups" on public.accountability_group_members;
create policy "Users leave groups"
  on public.accountability_group_members for delete to authenticated
  using (auth.uid() = user_id);

-- Check-ins
drop policy if exists "Check-ins visible" on public.accountability_checkins;
create policy "Check-ins visible"
  on public.accountability_checkins for select to authenticated using (true);

drop policy if exists "Users check in own" on public.accountability_checkins;
create policy "Users check in own"
  on public.accountability_checkins for insert to authenticated
  with check (auth.uid() = user_id);

-- Nudges
drop policy if exists "Nudges visible" on public.accountability_nudges;
create policy "Nudges visible"
  on public.accountability_nudges for select to authenticated using (true);

drop policy if exists "Users send nudges" on public.accountability_nudges;
create policy "Users send nudges"
  on public.accountability_nudges for insert to authenticated
  with check (auth.uid() = from_user and from_user <> to_user);
