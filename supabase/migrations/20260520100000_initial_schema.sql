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
  created_at timestamptz not null default now()
);

-- Spaces
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slug text not null unique,
  is_public boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.space_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
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
