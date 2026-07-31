-- ===== 1. 20260520100000_initial_schema.sql =====

create type public.profile_role as enum ('student', 'moderator', 'admin');
create type public.space_member_role as enum ('member', 'moderator');
create type public.material_type as enum ('file', 'link', 'note', 'flashcard_set');
create type public.material_priority as enum ('urgent', 'high', 'normal', 'low');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.report_target_type as enum ('thread', 'post', 'material', 'profile');
create type public.sanction_type as enum ('warn', 'mute', 'suspend');
create type public.event_visibility as enum ('private', 'space');
create type public.attendee_status as enum ('going', 'maybe');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role public.profile_role not null default 'student',
  storage_used_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  major text,
  bio text,
  interests text[],
  current_class_id uuid references public.spaces (id) on delete set null,
  gpa numeric(3,2) default 0.00,
  credits_completed integer default 0
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slug text not null unique,
  is_public boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
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
  status text not null default 'active'
);

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.spaces (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);

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

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

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
  calculated_grade varchar(10)
);

create index idx_space_members_user on public.space_members (user_id);
create index idx_threads_space on public.threads (space_id, created_at desc);
create index idx_posts_thread on public.posts (thread_id, created_at);
create index idx_materials_space on public.study_materials (space_id, created_at desc);
create index idx_schedule_owner on public.schedule_events (owner_id, starts_at);
create index idx_schedule_space on public.schedule_events (space_id, starts_at);
create index idx_reports_status on public.reports (status, created_at desc);
create index idx_sanctions_user on public.user_sanctions (user_id, expires_at);

create or replace function public.is_space_member(p_space_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.space_members where space_id = p_space_id and user_id = p_user_id); $$;

create or replace function public.is_space_moderator(p_space_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.space_members where space_id = p_space_id and user_id = p_user_id and role = 'moderator') or exists (select 1 from public.profiles where id = p_user_id and role in ('moderator', 'admin')); $$;

create or replace function public.is_app_moderator(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = p_user_id and role in ('moderator', 'admin')); $$;

create or replace function public.is_suspended(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_sanctions where user_id = p_user_id and type = 'suspend' and (expires_at is null or expires_at > now())); $$;

create or replace function public.is_muted(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_sanctions where user_id = p_user_id and type = 'mute' and (expires_at is null or expires_at > now())); $$;

create or replace function public.can_read_space(p_space_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.spaces s where s.id = p_space_id and (s.is_public or public.is_space_member(p_space_id))); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Student')); return new; end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.update_material_upvote_score()
returns trigger language plpgsql security definer set search_path = public
as $$ begin if tg_op = 'INSERT' then update public.study_materials set community_score = community_score + 1 where id = new.material_id; elsif tg_op = 'DELETE' then update public.study_materials set community_score = greatest(0, community_score - 1) where id = old.material_id; end if; return coalesce(new, old); end; $$;

create trigger on_material_upvote_change after insert or delete on public.material_upvotes for each row execute function public.update_material_upvote_score();

create or replace function public.update_storage_used()
returns trigger language plpgsql security definer set search_path = public
as $$ begin if tg_op = 'INSERT' then update public.profiles set storage_used_bytes = storage_used_bytes + new.size_bytes where id = new.user_id; elsif tg_op = 'DELETE' then update public.profiles set storage_used_bytes = greatest(0, storage_used_bytes - old.size_bytes) where id = old.user_id; end if; return coalesce(new, old); end; $$;

create trigger on_storage_object_change after insert or delete on public.storage_objects for each row execute function public.update_storage_used();

create or replace view public.user_material_rankings with (security_invoker = true) as
select mp.user_id, sm.id as material_id, sm.space_id, sm.title, sm.type, sm.community_score, mp.priority, mp.due_at, mp.notes,
  (case mp.priority when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 when 'low' then 1 end
  + case when mp.due_at is null then 0 when mp.due_at < now() then 3 when mp.due_at < now() + interval '3 days' then 2 when mp.due_at < now() + interval '7 days' then 1 else 0 end
  + least(sm.community_score, 10)::numeric / 10) as rank_score, sm.created_at
from public.material_priorities mp join public.study_materials sm on sm.id = mp.material_id where sm.is_hidden = false;

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

create policy "Profiles are viewable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Spaces readable if public or member" on public.spaces for select to authenticated using (is_public or public.is_space_member(id));
create policy "Authenticated users can create spaces" on public.spaces for insert to authenticated with check (auth.uid() = created_by and not public.is_suspended());
create policy "Space moderators can update spaces" on public.spaces for update to authenticated using (public.is_space_moderator(id) or created_by = auth.uid());
create policy "Space creators or app mods can delete spaces" on public.spaces for delete to authenticated using (created_by = auth.uid() or public.is_app_moderator());
create policy "Members visible to space readers" on public.space_members for select to authenticated using (public.can_read_space(space_id));
create policy "Users can join public spaces or be added" on public.space_members for insert to authenticated with check (auth.uid() = user_id and not public.is_suspended() and exists (select 1 from public.spaces s where s.id = space_id and (s.is_public or s.created_by = auth.uid())));
create policy "Users can leave spaces" on public.space_members for delete to authenticated using (auth.uid() = user_id);
create policy "Threads readable in accessible spaces" on public.threads for select to authenticated using (public.can_read_space(space_id) and (is_hidden = false or public.is_app_moderator()));
create policy "Members can create threads" on public.threads for insert to authenticated with check (auth.uid() = author_id and public.is_space_member(space_id) and not public.is_suspended() and not public.is_muted());
create policy "Authors and mods can update threads" on public.threads for update to authenticated using (auth.uid() = author_id or public.is_space_moderator(space_id) or public.is_app_moderator());
create policy "Authors and mods can delete threads" on public.threads for delete to authenticated using (auth.uid() = author_id or public.is_space_moderator(space_id) or public.is_app_moderator());
create policy "Posts readable with thread access" on public.posts for select to authenticated using (exists (select 1 from public.threads t where t.id = thread_id and public.can_read_space(t.space_id) and (posts.is_hidden = false or public.is_app_moderator())));
create policy "Members can create posts" on public.posts for insert to authenticated with check (auth.uid() = author_id and not public.is_suspended() and not public.is_muted() and exists (select 1 from public.threads t where t.id = thread_id and public.is_space_member(t.space_id) and t.is_locked = false));
create policy "Authors and mods can update posts" on public.posts for update to authenticated using (auth.uid() = author_id or exists (select 1 from public.threads t where t.id = thread_id and public.is_space_moderator(t.space_id)) or public.is_app_moderator());
create policy "Authors and mods can delete posts" on public.posts for delete to authenticated using (auth.uid() = author_id or public.is_app_moderator());
create policy "Reactions readable" on public.reactions for select to authenticated using (true);
create policy "Users can react" on public.reactions for insert to authenticated with check (auth.uid() = user_id and not public.is_suspended());
create policy "Users can remove own reactions" on public.reactions for delete to authenticated using (auth.uid() = user_id);
create policy "Tags readable" on public.tags for select to authenticated using (true);
create policy "Authenticated can create tags" on public.tags for insert to authenticated with check (true);
create policy "Materials readable in spaces" on public.study_materials for select to authenticated using (public.can_read_space(space_id) and (is_hidden = false or public.is_app_moderator()));
create policy "Members can add materials" on public.study_materials for insert to authenticated with check (auth.uid() = author_id and public.is_space_member(space_id) and not public.is_suspended());
create policy "Authors and mods can update materials" on public.study_materials for update to authenticated using (auth.uid() = author_id or public.is_space_moderator(space_id) or public.is_app_moderator());
create policy "Authors and mods can delete materials" on public.study_materials for delete to authenticated using (auth.uid() = author_id or public.is_space_moderator(space_id) or public.is_app_moderator());
create policy "Upvotes readable" on public.material_upvotes for select to authenticated using (true);
create policy "Users can upvote" on public.material_upvotes for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove upvote" on public.material_upvotes for delete to authenticated using (auth.uid() = user_id);
create policy "Users see own priorities" on public.material_priorities for select to authenticated using (auth.uid() = user_id);
create policy "Users manage own priorities" on public.material_priorities for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own priorities" on public.material_priorities for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own priorities" on public.material_priorities for delete to authenticated using (auth.uid() = user_id);
create policy "Material tags readable" on public.material_tags for select to authenticated using (true);
create policy "Authors can tag materials" on public.material_tags for insert to authenticated with check (exists (select 1 from public.study_materials sm where sm.id = material_id and sm.author_id = auth.uid()));
create policy "Events readable by owner or space members" on public.schedule_events for select to authenticated using ((visibility = 'private' and owner_id = auth.uid()) or (visibility = 'space' and space_id is not null and public.is_space_member(space_id)) or public.is_app_moderator());
create policy "Users create personal events" on public.schedule_events for insert to authenticated with check (not public.is_suspended() and ((visibility = 'private' and owner_id = auth.uid()) or (visibility = 'space' and space_id is not null and public.is_space_moderator(space_id))));
create policy "Owners and space mods update events" on public.schedule_events for update to authenticated using (owner_id = auth.uid() or (space_id is not null and public.is_space_moderator(space_id)) or public.is_app_moderator());
create policy "Owners and mods delete events" on public.schedule_events for delete to authenticated using (owner_id = auth.uid() or public.is_app_moderator());
create policy "Attendees readable for accessible events" on public.event_attendees for select to authenticated using (exists (select 1 from public.schedule_events e where e.id = event_id and ((e.visibility = 'private' and e.owner_id = auth.uid()) or (e.visibility = 'space' and e.space_id is not null and public.is_space_member(e.space_id)))));
create policy "Users manage own attendance" on public.event_attendees for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own attendance" on public.event_attendees for update to authenticated using (auth.uid() = user_id);
create policy "Users remove own attendance" on public.event_attendees for delete to authenticated using (auth.uid() = user_id);
create policy "Users can create reports" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "Mods can view reports" on public.reports for select to authenticated using (public.is_app_moderator());
create policy "Mods can update reports" on public.reports for update to authenticated using (public.is_app_moderator());
create policy "Mods view moderation log" on public.moderation_actions for select to authenticated using (public.is_app_moderator());
create policy "Mods insert moderation log" on public.moderation_actions for insert to authenticated with check (public.is_app_moderator() and auth.uid() = actor_id);
create policy "Users see own sanctions" on public.user_sanctions for select to authenticated using (auth.uid() = user_id or public.is_app_moderator());
create policy "Mods create sanctions" on public.user_sanctions for insert to authenticated with check (public.is_app_moderator() and auth.uid() = created_by);
create policy "Users see own storage" on public.storage_objects for select to authenticated using (auth.uid() = user_id or public.is_app_moderator());
create policy "Users insert own storage records" on public.storage_objects for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own storage records" on public.storage_objects for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
       ('materials', 'materials', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own avatar" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read own material files" on storage.objects for select to authenticated using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can upload material files" on storage.objects for insert to authenticated with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own material files" on storage.objects for update to authenticated using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own material files" on storage.objects for delete to authenticated using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.threads;

-- ===== 2. 20260524100000_profile_insert_policy.sql =====
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- ===== 3. 20260715000000_security.sql =====
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

create policy "Mods can view audit logs"
  on public.audit_log for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin')));

create policy "Server can insert audit logs"
  on public.audit_log for insert to authenticated
  with check (true);

create or replace function public.check_update_rate()
returns trigger language plpgsql security definer set search_path = public
as $$ begin if old.updated_at is not null and old.updated_at > now() - interval '10 seconds' then raise exception 'Please wait before updating your profile again'; end if; return new; end; $$;

alter table public.profiles add column if not exists updated_at timestamptz;

create trigger on_profile_update_rate
  before update on public.profiles
  for each row execute function public.check_update_rate();

create or replace function public.sanitize_display_name()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.display_name := regexp_replace(new.display_name, '[<>&\"''/]', '', 'g'); return new; end; $$;

create trigger on_profile_sanitize_name
  before insert or update on public.profiles
  for each row execute function public.sanitize_display_name();

-- ===== 4. 20260720000000_archive_security.sql (get_db_size only) =====
-- Note: archived_records table already exists in this project
create or replace function public.get_db_size()
returns bigint language sql security definer set search_path = public
as $$ select pg_database_size(current_database()); $$;

-- ===== 5. 20260727000000_meetings.sql =====
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

create policy "Meetings readable by space members"
  on public.meetings for select to authenticated
  using (space_id is null or exists (select 1 from public.space_members where space_id = meetings.space_id and user_id = auth.uid()) or organizer_id = auth.uid());

create policy "Members can create meetings"
  on public.meetings for insert to authenticated
  with check (auth.uid() = organizer_id and not public.is_suspended() and (space_id is null or exists (select 1 from public.space_members where space_id = meetings.space_id and user_id = auth.uid())));

create policy "Organizers can update meetings"
  on public.meetings for update to authenticated
  using (organizer_id = auth.uid() or public.is_app_moderator());

create policy "Organizers can delete meetings"
  on public.meetings for delete to authenticated
  using (organizer_id = auth.uid() or public.is_app_moderator());

create policy "Participants visible to meeting members"
  on public.meeting_participants for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and (m.organizer_id = auth.uid() or m.space_id is null or exists (select 1 from public.space_members where space_id = m.space_id and user_id = auth.uid()))));

create policy "Users can RSVP"
  on public.meeting_participants for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own RSVP"
  on public.meeting_participants for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can remove own RSVP"
  on public.meeting_participants for delete to authenticated
  using (auth.uid() = user_id);

create policy "Recipients can view own reminders"
  on public.meeting_reminders for select to authenticated
  using (recipient_id = auth.uid() or auth.uid() in (select organizer_id from public.meetings where id = meeting_id));

create policy "Server can insert reminders"
  on public.meeting_reminders for insert to authenticated
  with check (true);

create policy "Server can update reminders"
  on public.meeting_reminders for update to authenticated
  using (true);

-- ===== 6. 20260727000001_space_passwords.sql =====
alter table public.spaces add column if not exists join_password_hash text;
