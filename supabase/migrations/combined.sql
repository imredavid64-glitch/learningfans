-- ============ MIGRATION 1: 20260520100000_initial_schema.sql ============
-- LearningFans initial schema + RLS

-- Enums
create type public.profile_role as enum ('student', 'moderator', 'admin');
create type public.space_member_role as enum ('member', 'moderator');
create type public.material_type as enum ('file', 'link', 'note', 'flashcard_set');
create type public.material_priority as enum ('urgent', 'high', 'normal', 'low');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.report_target_type as enum ('thread', 'post', 'material', 'profile');
create type public.sanction_type as enum ('warn', 'mute', 'suspend');
create type public.event_visibility as enum ('private', 'space');
create type public.attendee_status as enum ('going', 'maybe');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role public.profile_role not null default 'student',
  storage_used_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  -- Student-specific fields
  major text,
  bio text,
  interests text[],
  current_class_id uuid references public.spaces (id) on delete set null,
  gpa numeric(3,2) default 0.00,
  credits_completed integer default 0
);

-- Spaces (class communities)
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slug text not null unique,
  is_public boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Class-specific fields
  class_code text,
  semester text,
  quarter text,
  instructor text,
  department text,
  room text,
  meeting_schedule text
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.space_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id),
  -- Class enrollment tracking
  status text not null default 'active' -- 'active'|'completed'|'dropped'
);

-- Class enrollments (student per class)
create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.spaces (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active', -- 'active'|'completed'|'dropped'
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- Discussion
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- Tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Study materials
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  type public.material_type not null,
  title text not null,
  description text,
  url text,
  storage_path text,
  metadata jsonb not null default '{}',
  community_score int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.material_upvotes (
  material_id uuid not null references public.study_materials (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (material_id, user_id)
);

create table public.material_priorities (
  material_id uuid not null references public.study_materials (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  priority public.material_priority not null default 'normal',
  due_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (material_id, user_id)
);

create table public.material_tags (
  material_id uuid not null references public.study_materials (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (material_id, tag_id)
);

-- Schedules
create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'UTC',
  owner_id uuid references public.profiles (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete cascade,
  visibility public.event_visibility not null default 'private',
  linked_material_id uuid references public.study_materials (id) on delete set null,
  reminder_minutes_before int,
  created_at timestamptz not null default now()
);

create table public.event_attendees (
  event_id uuid not null references public.schedule_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendee_status not null default 'going',
  primary key (event_id, user_id)
);

-- Moderation
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.sanction_type not null,
  expires_at timestamptz,
  reason text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Storage accounting
create table public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null,
  path text not null,
  size_bytes bigint not null,
  material_id uuid references public.study_materials (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- Grades table
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid not null references public.study_materials (id) on delete cascade,
  score numeric(5,2) not null,
  letter_grade varchar(2),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  graded_by uuid references public.profiles (id) on delete set null,
  feedback text,
  unique (student_id, assignment_id),
  -- Performance tracking
  calculated_grade varchar(10) -- 'A','B+','C-','D','F','I'|'W'
);

-- Indexes
create index idx_space_members_user on public.space_members (user_id);
create index idx_threads_space on public.threads (space_id, created_at desc);
create index idx_posts_thread on public.posts (thread_id, created_at);
create index idx_materials_space on public.study_materials (space_id, created_at desc);
create index idx_schedule_owner on public.schedule_events (owner_id, starts_at);
create index idx_schedule_space on public.schedule_events (space_id, starts_at);
create index idx_reports_status on public.reports (status, created_at desc);
create index idx_sanctions_user on public.user_sanctions (user_id, expires_at);

-- Helper functions
create or replace function public.is_space_member(p_space_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = p_user_id
  );
$$;

create or replace function public.is_space_moderator(p_space_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = p_user_id and role = 'moderator'
  )
  or exists (
    select 1 from public.profiles
    where id = p_user_id and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_app_moderator(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_suspended(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_sanctions
    where user_id = p_user_id
      and type = 'suspend'
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.is_muted(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_sanctions
    where user_id = p_user_id
      and type = 'mute'
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.can_read_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space_id
      and (s.is_public or public.is_space_member(p_space_id))
  );
$$;

-- Profile trigger on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Upvote score trigger
create or replace function public.update_material_upvote_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.study_materials set community_score = community_score + 1 where id = new.material_id;
  elsif tg_op = 'DELETE' then
    update public.study_materials set community_score = greatest(0, community_score - 1) where id = old.material_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_material_upvote_change
  after insert or delete on public.material_upvotes
  for each row execute function public.update_material_upvote_score();

-- Storage quota trigger
create or replace function public.update_storage_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set storage_used_bytes = storage_used_bytes + new.size_bytes where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set storage_used_bytes = greatest(0, storage_used_bytes - old.size_bytes) where id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_storage_object_change
  after insert or delete on public.storage_objects
  for each row execute function public.update_storage_used();

-- Priority ranking view
create or replace view public.user_material_rankings
with (security_invoker = true)
as
select
  mp.user_id,
  sm.id as material_id,
  sm.space_id,
  sm.title,
  sm.type,
  sm.community_score,
  mp.priority,
  mp.due_at,
  mp.notes,
  (
    case mp.priority
      when 'urgent' then 4
      when 'high' then 3
      when 'normal' then 2
      when 'low' then 1
    end
    + case
      when mp.due_at is null then 0
      when mp.due_at < now() then 3
      when mp.due_at < now() + interval '3 days' then 2
      when mp.due_at < now() + interval '7 days' then 1
      else 0
    end
    + least(sm.community_score, 10)::numeric / 10
  ) as rank_score,
  sm.created_at
from public.material_priorities mp
join public.study_materials sm on sm.id = mp.material_id
where sm.is_hidden = false;

-- Enable RLS
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

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- Spaces policies
create policy "Spaces readable if public or member"
  on public.spaces for select to authenticated
  using (is_public or public.is_space_member(id));

create policy "Authenticated users can create spaces"
  on public.spaces for insert to authenticated
  with check (auth.uid() = created_by and not public.is_suspended());

create policy "Space moderators can update spaces"
  on public.spaces for update to authenticated
  using (public.is_space_moderator(id) or created_by = auth.uid());

create policy "Space creators or app mods can delete spaces"
  on public.spaces for delete to authenticated
  using (created_by = auth.uid() or public.is_app_moderator());

-- Space members policies
create policy "Members visible to space readers"
  on public.space_members for select to authenticated
  using (public.can_read_space(space_id));

create policy "Users can join public spaces or be added"
  on public.space_members for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (select 1 from public.spaces s where s.id = space_id and (s.is_public or s.created_by = auth.uid()))
  );

create policy "Users can leave spaces"
  on public.space_members for delete to authenticated
  using (auth.uid() = user_id);

-- Threads policies
create policy "Threads readable in accessible spaces"
  on public.threads for select to authenticated
  using (
    public.can_read_space(space_id)
    and (is_hidden = false or public.is_app_moderator())
  );

create policy "Members can create threads"
  on public.threads for insert to authenticated
  with check (
    auth.uid() = author_id
    and public.is_space_member(space_id)
    and not public.is_suspended()
    and not public.is_muted()
  );

create policy "Authors and mods can update threads"
  on public.threads for update to authenticated
  using (
    auth.uid() = author_id
    or public.is_space_moderator(space_id)
    or public.is_app_moderator()
  );

create policy "Authors and mods can delete threads"
  on public.threads for delete to authenticated
  using (
    auth.uid() = author_id
    or public.is_space_moderator(space_id)
    or public.is_app_moderator()
  );

-- Posts policies
create policy "Posts readable with thread access"
  on public.posts for select to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and public.can_read_space(t.space_id)
        and (posts.is_hidden = false or public.is_app_moderator())
    )
  );

create policy "Members can create posts"
  on public.posts for insert to authenticated
  with check (
    auth.uid() = author_id
    and not public.is_suspended()
    and not public.is_muted()
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and public.is_space_member(t.space_id)
        and t.is_locked = false
    )
  );

create policy "Authors and mods can update posts"
  on public.posts for update to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.threads t
      where t.id = thread_id and public.is_space_moderator(t.space_id)
    )
    or public.is_app_moderator()
  );

create policy "Authors and mods can delete posts"
  on public.posts for delete to authenticated
  using (
    auth.uid() = author_id
    or public.is_app_moderator()
  );

-- Reactions policies
create policy "Reactions readable"
  on public.reactions for select to authenticated using (true);

create policy "Users can react"
  on public.reactions for insert to authenticated
  with check (auth.uid() = user_id and not public.is_suspended());

create policy "Users can remove own reactions"
  on public.reactions for delete to authenticated
  using (auth.uid() = user_id);

-- Tags policies
create policy "Tags readable"
  on public.tags for select to authenticated using (true);

create policy "Authenticated can create tags"
  on public.tags for insert to authenticated with check (true);

-- Study materials policies
create policy "Materials readable in spaces"
  on public.study_materials for select to authenticated
  using (
    public.can_read_space(space_id)
    and (is_hidden = false or public.is_app_moderator())
  );

create policy "Members can add materials"
  on public.study_materials for insert to authenticated
  with check (
    auth.uid() = author_id
    and public.is_space_member(space_id)
    and not public.is_suspended()
  );

create policy "Authors and mods can update materials"
  on public.study_materials for update to authenticated
  using (
    auth.uid() = author_id
    or public.is_space_moderator(space_id)
    or public.is_app_moderator()
  );

create policy "Authors and mods can delete materials"
  on public.study_materials for delete to authenticated
  using (
    auth.uid() = author_id
    or public.is_space_moderator(space_id)
    or public.is_app_moderator()
  );

-- Material upvotes
create policy "Upvotes readable"
  on public.material_upvotes for select to authenticated using (true);

create policy "Users can upvote"
  on public.material_upvotes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove upvote"
  on public.material_upvotes for delete to authenticated
  using (auth.uid() = user_id);

-- Material priorities
create policy "Users see own priorities"
  on public.material_priorities for select to authenticated
  using (auth.uid() = user_id);

create policy "Users manage own priorities"
  on public.material_priorities for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own priorities"
  on public.material_priorities for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own priorities"
  on public.material_priorities for delete to authenticated
  using (auth.uid() = user_id);

-- Material tags
create policy "Material tags readable"
  on public.material_tags for select to authenticated using (true);

create policy "Authors can tag materials"
  on public.material_tags for insert to authenticated
  with check (
    exists (
      select 1 from public.study_materials sm
      where sm.id = material_id and sm.author_id = auth.uid()
    )
  );

-- Schedule events
create policy "Events readable by owner or space members"
  on public.schedule_events for select to authenticated
  using (
    (visibility = 'private' and owner_id = auth.uid())
    or (visibility = 'space' and space_id is not null and public.is_space_member(space_id))
    or public.is_app_moderator()
  );

create policy "Users create personal events"
  on public.schedule_events for insert to authenticated
  with check (
    not public.is_suspended()
    and (
      (visibility = 'private' and owner_id = auth.uid())
      or (visibility = 'space' and space_id is not null and public.is_space_moderator(space_id))
    )
  );

create policy "Owners and space mods update events"
  on public.schedule_events for update to authenticated
  using (
    owner_id = auth.uid()
    or (space_id is not null and public.is_space_moderator(space_id))
    or public.is_app_moderator()
  );

create policy "Owners and mods delete events"
  on public.schedule_events for delete to authenticated
  using (
    owner_id = auth.uid()
    or public.is_app_moderator()
  );

-- Event attendees
create policy "Attendees readable for accessible events"
  on public.event_attendees for select to authenticated
  using (
    exists (
      select 1 from public.schedule_events e
      where e.id = event_id
        and (
          (e.visibility = 'private' and e.owner_id = auth.uid())
          or (e.visibility = 'space' and e.space_id is not null and public.is_space_member(e.space_id))
        )
    )
  );

create policy "Users manage own attendance"
  on public.event_attendees for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own attendance"
  on public.event_attendees for update to authenticated
  using (auth.uid() = user_id);

create policy "Users remove own attendance"
  on public.event_attendees for delete to authenticated
  using (auth.uid() = user_id);

-- Reports
create policy "Users can create reports"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "Mods can view reports"
  on public.reports for select to authenticated
  using (public.is_app_moderator());

create policy "Mods can update reports"
  on public.reports for update to authenticated
  using (public.is_app_moderator());

-- Moderation actions (mods only)
create policy "Mods view moderation log"
  on public.moderation_actions for select to authenticated
  using (public.is_app_moderator());

create policy "Mods insert moderation log"
  on public.moderation_actions for insert to authenticated
  with check (public.is_app_moderator() and auth.uid() = actor_id);

-- Sanctions
create policy "Users see own sanctions"
  on public.user_sanctions for select to authenticated
  using (auth.uid() = user_id or public.is_app_moderator());

create policy "Mods create sanctions"
  on public.user_sanctions for insert to authenticated
  with check (public.is_app_moderator() and auth.uid() = created_by);

-- Storage objects
create policy "Users see own storage"
  on public.storage_objects for select to authenticated
  using (auth.uid() = user_id or public.is_app_moderator());

create policy "Users insert own storage records"
  on public.storage_objects for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users delete own storage records"
  on public.storage_objects for delete to authenticated
  using (auth.uid() = user_id);

-- Storage buckets (run after buckets created in dashboard or via API)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('materials', 'materials', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;

-- Storage policies
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read own material files"
  on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload material files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own material files"
  on storage.objects for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own material files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.threads;

-- ============ MIGRATION 2: 20260524100000_profile_insert_policy.sql ============
-- Allow users to create their own profile if the signup trigger did not run
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- ============ MIGRATION 3: 20260528100000_profile_insert_policy_only.sql ============
-- Safe to run if you already applied the main migration but missed this policy.
-- Ignores error if policy already exists.

do $$
begin
  create policy "Users can insert own profile"
    on public.profiles for insert to authenticated
    with check (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

-- ============ MIGRATION 4: 20260715000000_security.sql ============
-- Audit log table
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  ip_address text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_audit_log_user on public.audit_log (user_id, created_at desc);
create index idx_audit_log_action on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

-- Only app moderators/admins can view audit logs
create policy "Mods can view audit logs"
  on public.audit_log for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('moderator', 'admin')
    )
  );

-- Service role (server-side) can insert audit logs
create policy "Server can insert audit logs"
  on public.audit_log for insert to authenticated
  with check (true);

-- Rate limit the profile update to prevent abuse
create or replace function public.check_update_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.updated_at is not null and old.updated_at > now() - interval '10 seconds' then
    raise exception 'Please wait before updating your profile again';
  end if;
  return new;
end;
$$;

-- Add updated_at to profiles if not present
alter table public.profiles add column if not exists updated_at timestamptz;

create trigger on_profile_update_rate
  before update on public.profiles
  for each row execute function public.check_update_rate();

-- Sanitize display_name on insert
create or replace function public.sanitize_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.display_name := regexp_replace(new.display_name, '[<>&"''/]', '', 'g');
  return new;
end;
$$;

create trigger on_profile_sanitize_name
  before insert or update on public.profiles
  for each row execute function public.sanitize_display_name();

-- ============ MIGRATION 5: 20260720000000_archive_security.sql ============
-- get_db_size: returns database size in bytes
create or replace function public.get_db_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

-- Run this SQL in the ARCHIVE Supabase project's SQL editor:
-- (the old project at xhximqrchwwwwwsysgdo.supabase.co)
--
-- CREATE TABLE public.archived_records (
--   id uuid primary key default gen_random_uuid(),
--   table_name text not null,
--   record_id uuid not null,
--   data jsonb not null,
--   archived_at timestamptz not null default now()
-- );
--
-- CREATE INDEX idx_archived_records_table ON public.archived_records (table_name, archived_at);
--
-- ALTER TABLE public.archived_records ENABLE ROW LEVEL SECURITY;
--
-- -- Only allow service role access
-- CREATE POLICY "Service role can manage archived records"
--   ON public.archived_records
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);
--
-- Also run the main schema migration (20260520100000_initial_schema.sql) on this project

-- ============ MIGRATION 6: 20260727000000_meetings.sql ============
create type public.meeting_status as enum ('scheduled', 'live', 'completed', 'cancelled');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  call_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  status public.meeting_status not null default 'scheduled',
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_participants (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rsvp_status text not null default 'pending',
  invited_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table public.meeting_reminders (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reminder_text text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_meetings_space on public.meetings (space_id, starts_at);
create index idx_meetings_organizer on public.meetings (organizer_id, starts_at);
create index idx_meeting_participants_user on public.meeting_participants (user_id);
create index idx_meeting_reminders_pending on public.meeting_reminders (scheduled_for) where sent_at is null;

alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_reminders enable row level security;

-- Meetings policies
create policy "Meetings readable by space members"
  on public.meetings for select to authenticated
  using (
    space_id is null
    or exists (
      select 1 from public.space_members
      where space_id = meetings.space_id and user_id = auth.uid()
    )
    or organizer_id = auth.uid()
  );

create policy "Members can create meetings"
  on public.meetings for insert to authenticated
  with check (
    auth.uid() = organizer_id
    and not public.is_suspended()
    and (
      space_id is null
      or exists (
        select 1 from public.space_members
        where space_id = meetings.space_id and user_id = auth.uid()
      )
    )
  );

create policy "Organizers can update meetings"
  on public.meetings for update to authenticated
  using (organizer_id = auth.uid() or public.is_app_moderator());

create policy "Organizers can delete meetings"
  on public.meetings for delete to authenticated
  using (organizer_id = auth.uid() or public.is_app_moderator());

-- Participants policies
create policy "Participants visible to meeting members"
  on public.meeting_participants for select to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.organizer_id = auth.uid() or m.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = m.space_id and user_id = auth.uid()
          ))
    )
  );

create policy "Users can RSVP"
  on public.meeting_participants for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own RSVP"
  on public.meeting_participants for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can remove own RSVP"
  on public.meeting_participants for delete to authenticated
  using (auth.uid() = user_id);

-- Reminders policies
create policy "Recipients can view own reminders"
  on public.meeting_reminders for select to authenticated
  using (recipient_id = auth.uid() or auth.uid() in (
    select organizer_id from public.meetings where id = meeting_id
  ));

create policy "Server can insert reminders"
  on public.meeting_reminders for insert to authenticated
  with check (true);

create policy "Server can update reminders"
  on public.meeting_reminders for update to authenticated
  using (true);

-- ============ MIGRATION 7: 20260727000001_space_passwords.sql ============
-- Add password protection to spaces
alter table public.spaces 
  add column if not exists join_password_hash text;

-- Update the can_read_space function to not require membership for viewing
create or replace function public.can_read_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space_id
      and (s.is_public or public.is_space_member(p_space_id))
  );
$$;

-- ============ MIGRATION 8: 20260728000000_multi_tenant_schools.sql ============
-- Schools table for multi-tenant architecture
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  subdomain text not null unique,
  status text not null default 'provisioning',
  owner_id uuid references public.profiles (id) on delete set null,
  supabase_project_ref text,
  supabase_url text,
  supabase_anon_key text,
  supabase_service_role_key text,
  region text not null default 'us-east-1',
  plan text not null default 'free',
  ai_agent_enabled boolean not null default true,
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schools_slug on public.schools (slug);
create index idx_schools_subdomain on public.schools (subdomain);
create index idx_schools_owner on public.schools (owner_id);

alter table public.schools enable row level security;

create policy "Schools visible to all authenticated"
  on public.schools for select to authenticated using (true);

create policy "Admins can insert schools"
  on public.schools for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update schools"
  on public.schools for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete schools"
  on public.schools for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============ MIGRATION 9: 20260807000000_profanity_escalation.sql ============
-- ===== 7. 20260807000000_profanity_escalation.sql =====

-- Add columns to profiles for tracking profanity violations and restrictions
alter table public.profiles 
add column if not exists profanity_warnings int not null default 0,
add column if not exists profanity_violations int not null default 0,
add column if not exists restriction_level text not null default 'none' check (restriction_level in ('none', 'warning', 'restricted', 'suspended')),
add column if not exists parent_email text,
add column if not exists principal_email text,
add column if not exists school_name text,
add column if not exists last_profanity_at timestamptz;

-- Table to track each profanity incident
create table public.profanity_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_text text not null,
  detected_words text[] not null,
  context_type text not null, -- 'post', 'thread', 'material', 'message'
  context_id uuid,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  action_taken text not null check (action_taken in ('warning', 'restriction', 'suspension', 'parent_notification', 'principal_notification')),
  created_at timestamptz not null default now()
);

create index idx_profanity_incidents_user on public.profanity_incidents (user_id, created_at desc);
create index idx_profanity_incidents_context on public.profanity_incidents (context_type, context_id);

alter table public.profanity_incidents enable row level security;

create policy "Users can view own profanity incidents" on public.profanity_incidents for select to authenticated using (auth.uid() = user_id);
create policy "Moderators can view all profanity incidents" on public.profanity_incidents for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin')));
create policy "Server can insert profanity incidents" on public.profanity_incidents for insert to authenticated with check (true);

-- Table for email notifications sent
create table public.profanity_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  incident_id uuid not null references public.profanity_incidents (id) on delete cascade,
  recipient_type text not null check (recipient_type in ('parent', 'principal')),
  recipient_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_profanity_notifications_user on public.profanity_notifications (user_id, created_at desc);
create index idx_profanity_notifications_status on public.profanity_notifications (status, created_at);

alter table public.profanity_notifications enable row level security;

create policy "Moderators can view profanity notifications" on public.profanity_notifications for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin')));
create policy "Server can insert profanity notifications" on public.profanity_notifications for insert to authenticated with check (true);
create policy "Server can update profanity notifications" on public.profanity_notifications for update to authenticated with check (true);

-- Function to handle profanity escalation
create or replace function public.handle_profanity_escalation(
  p_user_id uuid,
  p_content text,
  p_detected_words text[],
  p_context_type text,
  p_context_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_warning_count int;
  v_violation_count int;
  v_action_taken text;
  v_severity text;
  v_restriction_level text;
begin
  -- Get current profile
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return;
  end if;

  -- Determine severity based on detected words
  v_severity := case 
    when array_length(p_detected_words, 1) >= 3 then 'severe'
    when array_length(p_detected_words, 1) >= 2 then 'moderate'
    else 'mild'
  end;

  -- Increment counters
  v_warning_count := v_profile.profanity_warnings;
  v_violation_count := v_profile.profanity_violations + 1;

  -- Determine action based on escalation tier
  if v_profile.restriction_level = 'suspended' then
    v_action_taken := 'suspension';
  elsif v_profile.restriction_level = 'restricted' then
    v_action_taken := 'suspension';
    v_restriction_level := 'suspended';
  elsif v_profile.restriction_level = 'warning' then
    v_action_taken := 'restriction';
    v_restriction_level := 'restricted';
  else
    v_action_taken := 'warning';
    v_restriction_level := 'warning';
  end if;

  -- Update profile
  update public.profiles set
    profanity_warnings = v_warning_count + case when v_action_taken = 'warning' then 1 else 0 end,
    profanity_violations = v_violation_count,
    restriction_level = v_restriction_level,
    last_profanity_at = now()
  where id = p_user_id;

  -- Log the incident
  insert into public.profanity_incidents (
    user_id, content_text, detected_words, context_type, context_id, severity, action_taken
  ) values (
    p_user_id, p_content, p_detected_words, p_context_type, p_context_id, v_severity, v_action_taken
  );

  -- Log moderation action
  insert into public.moderation_actions (actor_id, action, target_type, target_id, note)
  values (p_user_id, 'profanity_' || v_action_taken, 'profile', p_user_id, 
    'Auto-detected profanity: ' || array_to_string(p_detected_words, ', '));

  -- Send notifications based on escalation level
  if v_action_taken = 'restriction' and v_profile.parent_email is not null then
    insert into public.profanity_notifications (
      user_id, incident_id, recipient_type, recipient_email, subject, body
    ) values (
      p_user_id, 
      (select id from public.profanity_incidents where user_id = p_user_id order by created_at desc limit 1),
      'parent', v_profile.parent_email,
      'LearningFans: Content Moderation Notice - Restriction Applied',
      'Dear Parent/Guardian,

Your student ' || v_profile.display_name || ' has been restricted on LearningFans due to repeated profanity violations.

Details:
- Violation count: ' || v_violation_count || '
- Detected language: ' || array_to_string(p_detected_words, ', ') || '
- Context: ' || p_context_type || '
- Action: Account restricted to read-only mode

Please discuss appropriate online communication with your student. The restriction will be reviewed after 7 days of clean behavior.

- LearningFans Safety Team
'
    );
  end if;

  if v_action_taken = 'suspension' and v_profile.principal_email is not null then
    insert into public.profanity_notifications (
      user_id, incident_id, recipient_type, recipient_email, subject, body
    ) values (
      p_user_id,
      (select id from public.profanity_incidents where user_id = p_user_id order by created_at desc limit 1),
      'principal', v_profile.principal_email,
      'LearningFans: Student Account Suspended - Policy Violation',
      'Dear Principal/Administrator,

A student from your school (' || coalesce(v_profile.school_name, 'Unknown School') || ') has been suspended from LearningFans due to severe repeated profanity violations.

Student: ' || v_profile.display_name || ' (' || v_profile.id || ')
Violation count: ' || v_violation_count || '
Detected language: ' || array_to_string(p_detected_words, ', ') || '
Context: ' || p_context_type || '
Action: Account suspended

This automated notification is sent per LearningFans safety policy when a student reaches the suspension tier. The student''s account is now suspended pending administrative review.

- LearningFans Safety Team
'
    );
  end if;

  -- Also notify parent on suspension
  if v_action_taken = 'suspension' and v_profile.parent_email is not null then
    insert into public.profanity_notifications (
      user_id, incident_id, recipient_type, recipient_email, subject, body
    ) values (
      p_user_id,
      (select id from public.profanity_incidents where user_id = p_user_id order by created_at desc limit 1),
      'parent', v_profile.parent_email,
      'LearningFans: Account Suspended - Immediate Attention Required',
      'Dear Parent/Guardian,

Your student ' || v_profile.display_name || ' has been SUSPENDED from LearningFans due to severe repeated profanity violations.

This is the final escalation tier. The account is now suspended and cannot access LearningFans features.

Violation count: ' || v_violation_count || '
Detected language: ' || array_to_string(p_detected_words, ', ')
Context: ' || p_context_type || '

Please contact LearningFans support if you believe this is in error or to discuss reinstatement.

- LearningFans Safety Team
'
    );
  end if;
end;
$$;

-- Function to check if user is restricted
create or replace function public.is_profanity_restricted(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select restriction_level in ('restricted', 'suspended') from public.profiles where id = p_user_id; $$;

-- Function to get user's profanity status
create or replace function public.get_profanity_status(p_user_id uuid default auth.uid())
returns table (
  warnings int,
  violations int,
  restriction_level text,
  last_incident_at timestamptz
) language sql stable security definer set search_path = public
as $$ select profanity_warnings, profanity_violations, restriction_level, last_profanity_at from public.profiles where id = p_user_id; $$;
-- ============ MIGRATION 10: 20260811000000_study_progress_notifications.sql ============
-- LearningFans: Gamification (XP / streaks) + Notifications
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

-- ------------------------------------------------------------------
-- Gamification: user stats (XP, streaks, level)
-- ------------------------------------------------------------------
create table public.user_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_xp bigint not null default 0,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_study_date date,
  daily_checkin_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_stats_xp on public.user_stats (total_xp desc);

-- Level is derived from XP: 100 XP per level (level 1 = 0-99, level 2 = 100-199, ...)
create or replace function public.xp_to_level(p_xp bigint)
returns int
language sql
immutable
as $$
  select 1 + floor(greatest(0, p_xp) / 100.0)::int;
$$;

-- Award XP and roll the study streak forward based on last_study_date.
-- Returns the caller's fresh stats + streak metadata.
create or replace function public.award_xp(
  p_user_id uuid,
  p_amount int default 5,
  p_reason text default 'study'
)
returns table (
  total_xp bigint,
  current_streak int,
  longest_streak int,
  level int,
  streak_incremented boolean,
  bonus_xp int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_stats public.user_stats%rowtype;
  v_bonus int := 0;
  v_streak_incremented boolean := false;
begin
  select * into v_stats from public.user_stats where user_id = p_user_id;
  if not found then
    insert into public.user_stats (user_id, total_xp, current_streak, longest_streak, last_study_date)
    values (p_user_id, 0, 0, 0, null);
    v_stats.current_streak := 0;
    v_stats.longest_streak := 0;
  end if;

  if v_stats.last_study_date is null or v_stats.last_study_date < v_today - 1 then
    -- Fresh (or reset) streak: first study day in a while
    update public.user_stats set current_streak = 1, last_study_date = v_today
      where user_id = p_user_id;
    v_stats.current_streak := 1;
  elsif v_stats.last_study_date = v_today - 1 then
    -- Consecutive day: streak continues + bonus XP
    update public.user_stats set current_streak = current_streak + 1, last_study_date = v_today
      where user_id = p_user_id;
    v_stats.current_streak := v_stats.current_streak + 1;
    v_bonus := 5 + least(v_stats.current_streak, 7);
    v_streak_incremented := true;
  end if;
  -- last_study_date = today: streak unchanged, just XP

  update public.user_stats
    set total_xp = total_xp + p_amount + v_bonus,
        updated_at = now()
    where user_id = p_user_id;

  update public.user_stats
    set longest_streak = greatest(longest_streak, current_streak)
    where user_id = p_user_id;

  return query
    select us.total_xp, us.current_streak, us.longest_streak,
           public.xp_to_level(us.total_xp) as level,
           v_streak_incremented, v_bonus
    from public.user_stats us
    where us.user_id = p_user_id;
end;
$$;

-- Daily check-in: +5 XP once per day, keeps the streak alive.
create or replace function public.check_in(p_user_id uuid)
returns table (
  total_xp bigint,
  current_streak int,
  longest_streak int,
  level int,
  already_checked_in boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_stats public.user_stats%rowtype;
begin
  select * into v_stats from public.user_stats where user_id = p_user_id;
  if not found then
    insert into public.user_stats (user_id, total_xp, current_streak, longest_streak, last_study_date)
    values (p_user_id, 0, 0, 0, null);
    v_stats.current_streak := 0;
    v_stats.longest_streak := 0;
  end if;

  if v_stats.daily_checkin_date = v_today then
    return query
      select us.total_xp, us.current_streak, us.longest_streak,
             public.xp_to_level(us.total_xp), true
      from public.user_stats us where us.user_id = p_user_id;
    return;
  end if;

  if v_stats.last_study_date is null or v_stats.last_study_date < v_today - 1 then
    update public.user_stats set current_streak = 1 where user_id = p_user_id;
  elsif v_stats.last_study_date = v_today - 1 then
    update public.user_stats set current_streak = current_streak + 1 where user_id = p_user_id;
  end if;

  update public.user_stats
    set total_xp = total_xp + 5,
        last_study_date = v_today,
        daily_checkin_date = v_today,
        updated_at = now()
    where user_id = p_user_id;

  update public.user_stats
    set longest_streak = greatest(longest_streak, current_streak)
    where user_id = p_user_id;

  return query
    select us.total_xp, us.current_streak, us.longest_streak,
           public.xp_to_level(us.total_xp), false
    from public.user_stats us where us.user_id = p_user_id;
end;
$$;

-- Leaderboard: top users by XP (definer, since RLS hides other users' stats).
create or replace function public.get_leaderboard(p_limit int default 10)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_xp bigint,
  level int,
  current_streak int
)
language sql
security definer
set search_path = public
stable
as $$
  select us.user_id, p.display_name, p.avatar_url, us.total_xp,
         public.xp_to_level(us.total_xp) as level,
         us.current_streak
  from public.user_stats us
  join public.profiles p on p.id = us.user_id
  order by us.total_xp desc
  limit p_limit;
$$;

alter table public.user_stats enable row level security;

create policy "Users view own stats"
  on public.user_stats for select to authenticated
  using (auth.uid() = user_id);

create policy "Users update own stats"
  on public.user_stats for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users insert own stats"
  on public.user_stats for insert to authenticated
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null default 'system',
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, created_at desc);

create or replace function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_body text default '',
  p_type text default 'system',
  p_link text default null,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (p_user_id, p_actor_id, p_type, p_title, p_body, p_link);
end;
$$;

alter table public.notifications enable row level security;

create policy "Users view own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

create policy "Users mark own notifications read"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own notifications"
  on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Auto-notify on new materials, threads and meetings
-- ------------------------------------------------------------------
create or replace function public.notify_new_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_name text;
  v_author_name text;
  v_slug text;
begin
  select name, slug into v_space_name, v_slug from public.spaces where id = new.space_id;
  select display_name into v_author_name from public.profiles where id = new.author_id;
  if v_space_name is not null then
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    select sm.user_id, new.author_id, 'material',
      'New ' || replace(new.type::text, '_', ' ') || ' in ' || v_space_name,
      coalesce(v_author_name, 'Someone') || ' shared "' || new.title || '"',
      '/app/spaces/' || v_slug || '/materials/' || new.id
    from public.space_members sm
    where sm.space_id = new.space_id and sm.user_id <> new.author_id;
  end if;
  return new;
end;
$$;

create trigger on_new_material_notify
  after insert on public.study_materials
  for each row execute function public.notify_new_material();

create or replace function public.notify_new_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  select slug into v_slug from public.spaces where id = new.space_id;
  if v_slug is not null then
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    select sm.user_id, new.author_id, 'thread',
      'New discussion: ' || new.title,
      'Jump in and join the conversation',
      '/app/spaces/' || v_slug || '/threads/' || new.id
    from public.space_members sm
    where sm.space_id = new.space_id and sm.user_id <> new.author_id;
  end if;
  return new;
end;
$$;

create trigger on_new_thread_notify
  after insert on public.threads
  for each row execute function public.notify_new_thread();

create or replace function public.notify_new_meeting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer text;
begin
  select display_name into v_organizer from public.profiles where id = new.organizer_id;
  if new.space_id is not null then
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    select sm.user_id, new.organizer_id, 'meeting',
      'Meeting scheduled: ' || new.title,
      coalesce(v_organizer, 'An organizer') || ' scheduled a live call — RSVP now',
      '/app/meetings/' || new.id
    from public.space_members sm
    where sm.space_id = new.space_id and sm.user_id <> new.organizer_id;
  end if;
  return new;
end;
$$;

create trigger on_new_meeting_notify
  after insert on public.meetings
  for each row execute function public.notify_new_meeting();

-- Realtime for the notification bell
alter publication supabase_realtime add table public.notifications;

-- ============ MIGRATION 11: 20260812000001_reply_notifications.sql ============
-- LearningFans: Notify thread authors when someone replies
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Mirrors the existing notify_new_thread / notify_new_material triggers.

create or replace function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
  v_author_name text;
begin
  select t.id, t.title, t.author_id, t.space_id, s.slug
    into v_thread.id, v_thread.title, v_thread.author_id, v_thread.space_id, v_thread.slug
  from public.threads t
  join public.spaces s on s.id = t.space_id
  where t.id = new.thread_id;

  if v_thread.id is null then
    return new;
  end if;

  select display_name into v_author_name from public.profiles where id = new.author_id;

  -- Notify the thread author, but not when they reply to their own thread.
  if v_thread.author_id <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (
      v_thread.author_id,
      new.author_id,
      'reply',
      'New reply: ' || v_thread.title,
      coalesce(v_author_name, 'Someone') || ' replied to your discussion',
      '/app/spaces/' || v_thread.slug || '/threads/' || v_thread.id
    );
  end if;

  return new;
end;
$$;

create trigger on_new_post_notify
  after insert on public.posts
  for each row execute function public.notify_new_post();

-- ============ MIGRATION 12: 20260812000002_schedule_event_reminders.sql ============
-- LearningFans: Schedule event reminders
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Mirrors the meeting_reminders table: rows are generated when an event is
-- created (owner + RSVP'd attendees) and delivered by the in-app notifier.

create table public.schedule_event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reminder_text text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_schedule_event_reminders_pending
  on public.schedule_event_reminders (scheduled_for)
  where sent_at is null;

alter table public.schedule_event_reminders enable row level security;

create policy "Recipients view own event reminders"
  on public.schedule_event_reminders for select to authenticated
  using (recipient_id = auth.uid());

create policy "Server can insert event reminders"
  on public.schedule_event_reminders for insert to authenticated
  with check (true);

create policy "Server can update event reminders"
  on public.schedule_event_reminders for update to authenticated
  using (true);

-- ============ MIGRATION 13: 20260812000003_push_subscriptions.sql ============
-- LearningFans: Web push subscriptions
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Stores browser Push API subscriptions (VAPID, no Firebase needed) for PWA/browser delivery.
-- The native iOS/Android apps need the Capacitor Push plugin + FCM/APNs separately.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index idx_push_subscriptions_user on public.push_subscriptions (user_id);

-- Mark which notifications have already been pushed, so the cron is idempotent.
alter table public.notifications add column if not exists push_sent_at timestamptz;

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ MIGRATION 14: 20260812000004_study_rooms.sql ============
-- LearningFans: Interactive Study Rooms
-- Rooms people can join live: real-time whiteboard (broadcast), room chat
-- (postgres_changes realtime), presence, shared pomodoro, one-click video call.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'ended')),
  -- Serialized whiteboard strokes (jsonb array). Kept small on purpose:
  -- capped client-side (~256 KB) so the DB stays lean on the free tier.
  whiteboard jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_study_rooms_status on public.study_rooms (status, created_at desc);
create index idx_study_room_messages_room on public.study_room_messages (room_id, created_at);

alter table public.study_rooms enable row level security;
alter table public.study_room_messages enable row level security;

-- Rooms: anyone in the app can view global rooms; space rooms are limited to
-- space members (same model as meetings).
create policy "Study rooms viewable"
  on public.study_rooms for select to authenticated
  using (
    space_id is null
    or exists (
      select 1 from public.space_members
      where space_id = study_rooms.space_id and user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

create policy "Users create study rooms"
  on public.study_rooms for insert to authenticated
  with check (
    auth.uid() = created_by
    and not public.is_suspended()
    and (
      space_id is null
      or exists (
        select 1 from public.space_members
        where space_id = study_rooms.space_id and user_id = auth.uid()
      )
    )
  );

-- Collaborative whiteboard: any participant who can see the room may save
-- strokes / clear the board. Ending the room is limited to the creator or a
-- space/app moderator below.
create policy "Participants update study room whiteboard"
  on public.study_rooms for update to authenticated
  using (
    status = 'active'
    and (
      space_id is null
      or exists (
        select 1 from public.space_members
        where space_id = study_rooms.space_id and user_id = auth.uid()
      )
      or created_by = auth.uid()
    )
  );

create policy "Creators or moderators end study rooms"
  on public.study_rooms for update to authenticated
  using (created_by = auth.uid() or public.is_app_moderator());

create policy "Creators or moderators delete study rooms"
  on public.study_rooms for delete to authenticated
  using (created_by = auth.uid() or public.is_app_moderator());

-- Chat messages
create policy "Room chat visible to room participants"
  on public.study_room_messages for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_messages.room_id
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );

create policy "Users post in visible rooms"
  on public.study_room_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_messages.room_id
        and sr.status = 'active'
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );

create policy "Users delete own room messages"
  on public.study_room_messages for delete to authenticated
  using (auth.uid() = user_id);

-- Live chat via realtime
alter publication supabase_realtime add table public.study_room_messages;

-- ============ MIGRATION 15: 20260812000005_study_room_reactions.sql ============
-- LearningFans: Emoji reactions on study room chat messages
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table public.study_room_message_reactions (
  message_id uuid not null references public.study_room_messages (id) on delete cascade,
  -- Denormalized so realtime can filter per-room (postgres_changes supports
  -- simple column filters only).
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index idx_study_room_reactions_room on public.study_room_message_reactions (room_id, created_at);

alter table public.study_room_message_reactions enable row level security;

create policy "Reactions visible to room participants"
  on public.study_room_message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_message_reactions.room_id
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );

create policy "Users react in visible rooms"
  on public.study_room_message_reactions for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_message_reactions.room_id
        and sr.status = 'active'
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );

create policy "Users remove own reactions"
  on public.study_room_message_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- Live reactions via realtime
alter publication supabase_realtime add table public.study_room_message_reactions;

-- ============ MIGRATION 16: 20260812000006_community_rules.sql ============
-- LearningFans: Community rules + moderator announcements (Reddit-style)
-- Rules and announcements live on the space row as small jsonb arrays — one row
-- per community, no new tables, free-tier friendly. The existing "Space
-- moderators can update spaces" RLS policy already gates writes.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces
  add column if not exists rules jsonb not null default '[]'::jsonb,
  add column if not exists announcements jsonb not null default '[]'::jsonb;

-- App moderators (global role) can also manage any community's rules/announcements.
create policy "App moderators can update spaces"
  on public.spaces for update to authenticated
  using (public.is_app_moderator());

-- ============ MIGRATION 17: 20260812000007_thread_votes.sql ============
-- LearningFans: Thread upvotes/downvotes (Reddit-style)
-- A single post_votes table (one row per user per post) + cached score columns
-- on threads, maintained by a trigger so sorting stays cheap and consistent.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.threads
  add column if not exists score int not null default 0,
  add column if not exists ups int not null default 0,
  add column if not exists downs int not null default 0;

create table public.post_votes (
  post_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index idx_post_votes_user on public.post_votes (user_id);

alter table public.post_votes enable row level security;

create policy "Votes visible to thread readers"
  on public.post_votes for select to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = post_id
        and public.can_read_space(t.space_id)
        and (t.is_hidden = false or public.is_app_moderator())
    )
  );

create policy "Readers can vote on threads"
  on public.post_votes for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.threads t
      where t.id = post_id
        and public.can_read_space(t.space_id)
        and t.is_hidden = false
    )
  );

create policy "Users update own votes"
  on public.post_votes for update to authenticated
  using (auth.uid() = user_id);

create policy "Users delete own votes"
  on public.post_votes for delete to authenticated
  using (auth.uid() = user_id);

-- Recompute the cached score/ups/downs whenever a vote changes. Recomputing
-- (rather than incrementing) keeps the trigger idempotent and race-safe.
create or replace function public.update_thread_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid := coalesce(new.post_id, old.post_id);
begin
  update public.threads t
  set ups = v.ups,
      downs = v.downs,
      score = v.ups - v.downs
  from (
    select
      count(*) filter (where vote = 1) as ups,
      count(*) filter (where vote = -1) as downs
    from public.post_votes
    where post_id = v_thread
  ) v
  where t.id = v_thread;
  return coalesce(new, old);
end;
$$;

create trigger on_post_vote_changed
  after insert or update or delete on public.post_votes
  for each row execute function public.update_thread_score();

-- ============ MIGRATION 18: 20260812000008_quiz_posts.sql ============
-- LearningFans: Quiz posts (Reddit-for-learners Phase 3a)
-- Quizzes are study_materials of type 'quiz' (payload in metadata.questions);
-- quiz_attempts keeps ONE row per user per quiz with the best score, so the
-- community leaderboard stays lean on the free tier.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter type public.material_type add value if not exists 'quiz';

create table public.quiz_attempts (
  material_id uuid not null references public.study_materials (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  best_score_pct int not null check (best_score_pct between 0 and 100),
  best_correct int not null default 0,
  best_total int not null default 0,
  attempts int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (material_id, user_id)
);

create index idx_quiz_attempts_leaderboard on public.quiz_attempts (material_id, best_score_pct desc);

alter table public.quiz_attempts enable row level security;

create policy "Quiz scores visible to material readers"
  on public.quiz_attempts for select to authenticated
  using (
    exists (
      select 1 from public.study_materials sm
      where sm.id = material_id
        and public.can_read_space(sm.space_id)
        and (sm.is_hidden = false or public.is_app_moderator())
    )
  );

create policy "Users record own quiz attempts"
  on public.quiz_attempts for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_materials sm
      where sm.id = material_id
        and public.can_read_space(sm.space_id)
        and sm.is_hidden = false
    )
  );

create policy "Users update own quiz attempts"
  on public.quiz_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ MIGRATION 19: 20260812000009_post_flairs.sql ============
-- LearningFans: Post flairs (Reddit-for-learners Phase 2b)
-- Mod-defined, color-coded post labels per community ("Homework help",
-- "Exam prep", "Resource", ...). Flairs live as jsonb on spaces (same pattern
-- as rules/announcements); threads reference one by id.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces add column if not exists flairs jsonb not null default '[]'::jsonb;
alter table public.threads add column if not exists flair_id text;

create index if not exists idx_threads_space_flair
  on public.threads (space_id, flair_id)
  where flair_id is not null;

-- No new RLS needed: spaces updates are already mod-gated (community_rules
-- migration), and threads updates already allow authors + space/app mods.

-- ============ MIGRATION 20: 20260812000010_community_branding.sql ============
-- LearningFans: Community branding + directory (Reddit Phase 2b round 2)
-- icon_url / banner_url store full public storage URLs; the community-assets
-- bucket is public for reads (directory page + headers render plain <img>) and
-- write-gated to space mods / app mods.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces add column if not exists icon_url text;
alter table public.spaces add column if not exists banner_url text;

-- Public bucket: everyone may read, only mods may write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('community-assets', 'community-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Community assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'community-assets');

create policy "Community mods upload assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-assets'
    and (
      public.is_app_moderator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_space_moderator((storage.foldername(name))[1]::uuid)
      )
    )
  );

create policy "Community mods update assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-assets'
    and (
      public.is_app_moderator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_space_moderator((storage.foldername(name))[1]::uuid)
      )
    )
  );

create policy "Community mods delete assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-assets'
    and (
      public.is_app_moderator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_space_moderator((storage.foldername(name))[1]::uuid)
      )
    )
  );

-- No new RLS on spaces: mods/creator/app-mods already update spaces (0006 + initial schema).

-- ============ MIGRATION 21: 20260812000011_nested_replies.sql ============
-- LearningFans: Nested (threaded) replies (Reddit-style comment chains)
-- posts gain a self-referencing parent_id; the reply trigger also notifies the
-- parent comment author (when they aren't the thread author or the replier).
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.posts add column if not exists parent_id uuid references public.posts (id) on delete cascade;

create index if not exists idx_posts_thread_parent
  on public.posts (thread_id, parent_id);

create or replace function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
  v_author_name text;
  v_parent_author uuid;
begin
  select t.id, t.title, t.author_id, t.space_id, s.slug
    into v_thread.id, v_thread.title, v_thread.author_id, v_thread.space_id, v_thread.slug
  from public.threads t
  join public.spaces s on s.id = t.space_id
  where t.id = new.thread_id;

  if v_thread.id is null then
    return new;
  end if;

  select display_name into v_author_name from public.profiles where id = new.author_id;

  -- Notify the thread author, but not when they reply to their own thread.
  if v_thread.author_id <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (
      v_thread.author_id,
      new.author_id,
      'reply',
      'New reply: ' || v_thread.title,
      coalesce(v_author_name, 'Someone') || ' replied to your discussion',
      '/app/spaces/' || v_thread.slug || '/threads/' || v_thread.id
    );
  end if;

  -- Nested replies: also notify the parent comment author (unless it's the
  -- thread author — already notified above — or the replier themselves).
  if new.parent_id is not null then
    select author_id into v_parent_author from public.posts where id = new.parent_id;
    if v_parent_author is not null
       and v_parent_author <> new.author_id
       and v_parent_author <> v_thread.author_id then
      insert into public.notifications (user_id, actor_id, type, title, body, link)
      values (
        v_parent_author,
        new.author_id,
        'reply',
        'New reply to your comment',
        coalesce(v_author_name, 'Someone') || ' replied to your comment in ' || v_thread.title,
        '/app/spaces/' || v_thread.slug || '/threads/' || v_thread.id
      );
    end if;
  end if;

  return new;
end;
$$;

