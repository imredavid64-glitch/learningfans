-- ============================================================
-- LearningFans: ONE paste to enable migrations 0008-0017 + 0000-0007
-- Paste ALL of this into the SQL editor and run once:
-- https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- 0015 is FIRST: it is fully idempotent, so re-running it safely
-- completes the partially-applied chat moderation queue.
-- ============================================================

-- ============ 20260812000015_chat_moderation_queue.sql ============
-- LearningFans: Batched AI moderation for room chat
-- 1) chat_moderation_queue: messages awaiting AI review. The server action
--    inserts instantly (fast local checks only) and a background batch route
--    claims rows in chunks, sends them to Groq in ONE request, and hides +
--    logs anything high-risk. No per-message latency on the send path.
-- 2) study_room_messages.hidden: set by the moderation pipeline for flagged
--    messages so the client can render a "removed" placeholder.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.study_room_messages
  add column if not exists hidden boolean not null default false;

create table if not exists public.chat_moderation_queue (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.study_room_messages (id) on delete cascade,
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  status text not null default 'pending',      -- pending | processing | processed | failed
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_chat_moderation_queue_status
  on public.chat_moderation_queue (status, created_at);

alter table public.chat_moderation_queue enable row level security;

-- Atomic claim: flips pending rows to processing (bumping attempts) and
-- returns them, so concurrent flushes never process the same row twice.
create or replace function public.claim_chat_moderation_batch(p_limit int)
returns setof public.chat_moderation_queue
language sql
security definer
set search_path = public
as $$
  update public.chat_moderation_queue
  set status = 'processing', attempts = attempts + 1
  where id in (
    select id from public.chat_moderation_queue
    where status = 'pending'
    order by created_at
    limit p_limit
  )
  returning *;
$$;

-- Only the send path inserts (with the authenticated user's own id); the
-- batch route drains with the service role. Users never read or mutate the
-- queue directly.
drop policy if exists "Users enqueue their own chat messages"
  on public.chat_moderation_queue;
create policy "Users enqueue their own chat messages"
  on public.chat_moderation_queue for insert to authenticated
  with check (auth.uid() = user_id);


-- ============ 20260812000008_quiz_posts.sql ============
-- LearningFans: Quiz posts (Reddit-for-learners Phase 3a)
-- Quizzes are study_materials of type 'quiz' (payload in metadata.questions);
-- quiz_attempts keeps ONE row per user per quiz with the best score, so the
-- community leaderboard stays lean on the free tier.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter type public.material_type add value if not exists 'quiz';

create table if not exists public.quiz_attempts (
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

create index if not exists idx_quiz_attempts_leaderboard on public.quiz_attempts (material_id, best_score_pct desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "Quiz scores visible to material readers" on public.quiz_attempts;
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

drop policy if exists "Users record own quiz attempts" on public.quiz_attempts;
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

drop policy if exists "Users update own quiz attempts" on public.quiz_attempts;
create policy "Users update own quiz attempts"
  on public.quiz_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============ 20260812000009_post_flairs.sql ============
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


-- ============ 20260812000010_community_branding.sql ============
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

drop policy if exists "Community assets are publicly readable" on storage.objects;
create policy "Community assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'community-assets');

drop policy if exists "Community mods upload assets" on storage.objects;
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

drop policy if exists "Community mods update assets" on storage.objects;
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

drop policy if exists "Community mods delete assets" on storage.objects;
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


-- ============ 20260812000011_nested_replies.sql ============
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


-- ============ 20260812000012_saved_items.sql ============
-- LearningFans: Save / bookmark collections (Reddit "Saved" + folders)
-- Users collect threads and materials (including quizzes) into named folders.
-- item_id is polymorphic (thread vs material) — no FK, validated at the action
-- layer; each table is strictly user-owned via RLS.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table if not exists public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('thread', 'material')),
  item_id uuid not null,
  collection_id uuid references public.saved_collections (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create index if not exists idx_saved_items_user_created on public.saved_items (user_id, created_at desc);
create index if not exists idx_saved_items_collection on public.saved_items (collection_id);

alter table public.saved_collections enable row level security;
alter table public.saved_items enable row level security;

drop policy if exists "Users manage own saved collections" on public.saved_collections;
create policy "Users manage own saved collections"
  on public.saved_collections for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own saved items" on public.saved_items;
create policy "Users manage own saved items"
  on public.saved_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============ 20260812000013_weekly_digests.sql ============
-- LearningFans: Weekly community digest
-- One RPC called by the Vercel cron (/api/cron/digest) that, for each user with
-- a space membership, counts new discussions / materials / replies across their
-- communities in the last 7 days and inserts a single 'digest' notification
-- (skipping users who already got one this week or had no activity).
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create or replace function public.send_weekly_digests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_threads int;
  v_materials int;
  v_replies int;
  v_communities int;
  v_community_word text;
  v_sent int := 0;
begin
  for v_user in
    select distinct sm.user_id as uid
    from public.space_members sm
    join public.profiles p on p.id = sm.user_id
  loop
    -- At most one digest per user per rolling week.
    if exists (
      select 1 from public.notifications n
      where n.user_id = v_user.uid
        and n.type = 'digest'
        and n.created_at > now() - interval '7 days'
    ) then
      continue;
    end if;

    select count(*)
      into v_threads
    from public.threads t
    join public.space_members sm on sm.space_id = t.space_id and sm.user_id = v_user.uid
    where t.created_at > now() - interval '7 days'
      and t.is_hidden = false;

    select count(*)
      into v_materials
    from public.study_materials m
    join public.space_members sm on sm.space_id = m.space_id and sm.user_id = v_user.uid
    where m.created_at > now() - interval '7 days'
      and m.is_hidden = false;

    select count(*)
      into v_replies
    from public.posts p
    join public.threads t on t.id = p.thread_id
    join public.space_members sm on sm.space_id = t.space_id and sm.user_id = v_user.uid
    where p.created_at > now() - interval '7 days'
      and p.is_hidden = false;

    select count(distinct act.space_id)
      into v_communities
    from (
      select space_id from public.threads
      where created_at > now() - interval '7 days' and is_hidden = false
      union
      select space_id from public.study_materials
      where created_at > now() - interval '7 days' and is_hidden = false
      union
      select t.space_id from public.posts p
      join public.threads t on t.id = p.thread_id
      where p.created_at > now() - interval '7 days' and p.is_hidden = false
    ) act
    join public.space_members sm on sm.space_id = act.space_id and sm.user_id = v_user.uid;

    if v_threads = 0 and v_materials = 0 and v_replies = 0 then
      continue;
    end if;

    v_communities := greatest(v_communities, 1);
    v_community_word := case when v_communities = 1 then 'community' else 'communities' end;

    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (
      v_user.uid,
      null,
      'digest',
      'Your weekly community digest',
      v_threads || ' new discussions · ' || v_materials || ' new materials · '
        || v_replies || ' new replies across ' || v_communities || ' ' || v_community_word,
      '/app/feed'
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;


-- ============ 20260812000014_mod_dashboard_automod.sql ============
-- LearningFans: Mod dashboard + automod rules
-- 1) spaces.automod_rules: mod-defined keyword rules ('flag' or 'remove',
--    scoped to threads / posts / all), enforced in the server actions.
-- 2) moderation_actions.space_id: lets each community show its own mod log.
-- 3) Policies: space moderators may read their community's log, and the
--    automod/AI-flag pipeline may log auto_flag rows (previously the insert
--    policy blocked non-app-mods, so auto-flags were silently dropped).
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces add column if not exists automod_rules jsonb not null default '[]'::jsonb;

alter table public.moderation_actions
  add column if not exists space_id uuid references public.spaces (id) on delete cascade;

create index if not exists idx_moderation_actions_space
  on public.moderation_actions (space_id, created_at desc);

-- Space moderators can read their community's mod log (app mods already could).
drop policy if exists "Space mods view community moderation log"
  on public.moderation_actions;
create policy "Space mods view community moderation log"
  on public.moderation_actions for select to authenticated
  using (
    public.is_app_moderator()
    or (
      space_id is not null
      and public.is_space_moderator(space_id)
    )
  );

-- Let the automod / AI-flag pipeline log auto_flag rows (system-initiated,
-- attributed to the content author), while keeping manual mod actions to app
-- moderators.
drop policy if exists "Mods insert moderation log"
  on public.moderation_actions;
create policy "Mods insert moderation log"
  on public.moderation_actions for insert to authenticated
  with check (
    auth.uid() = actor_id
    and (
      public.is_app_moderator()
      or action = 'auto_flag'
    )
  );




-- ============ 20260813000000_user_profiles_upload_types.sql ============
-- LearningFans: user profiles (bio / major / interests) + broad file-type uploads
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

-- ------------------------------------------------------------------
-- Profiles: restore the missing student-profile columns (schema drift fix)
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists major text,
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists parent_email text,
  add column if not exists principal_email text,
  add column if not exists gpa numeric(3,2) default 0.00,
  add column if not exists current_class_id uuid references public.spaces (id) on delete set null,
  add column if not exists credits_completed int not null default 0;

-- Public (aggregate-only) stats snapshot for profile pages. RLS keeps
-- user_stats private, so expose just the gamification numbers via a
-- security-definer helper.
create or replace function public.get_public_stats(p_user_id uuid)
returns table (
  total_xp bigint,
  level int,
  current_streak int,
  longest_streak int
)
language sql
security definer
set search_path = public
stable
as $$
  select us.total_xp,
         public.xp_to_level(us.total_xp)::int as level,
         us.current_streak,
         us.longest_streak
  from public.user_stats us
  where us.user_id = p_user_id;
$$;

-- ------------------------------------------------------------------
-- Materials bucket: support many file types (docs, spreadsheets,
-- presentations, archives, audio, video) and a larger per-file cap.
-- ------------------------------------------------------------------
update storage.buckets
set file_size_limit = 15728640, -- 15 MB per file
    allowed_mime_types = array[
      -- Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/rtf',
      -- Plain text / code / data
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/html',
      'application/json',
      'application/xml',
      -- Archives
      'application/zip',
      'application/x-7z-compressed',
      'application/x-rar-compressed',
      'application/gzip',
      'application/x-tar',
      -- Images
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      -- Audio
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      -- Video
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-matroska'
    ]
where id = 'materials';

-- ============================================================
-- Migrations 0016, 0017 + the 20260813 batch (0001-0007)
-- ============================================================

-- ============ 20260812000016_message_reports.sql ============
-- LearningFans: Per-message reports in room chat
-- 1) report_target_type gains 'message' so users can report chat messages.
-- 2) App moderators can read room chat messages (even space-linked rooms)
--    so the mod queue can show the reported message when reviewing it.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter type public.report_target_type add value if not exists 'message';

drop policy if exists "Room chat visible to room participants"
  on public.study_room_messages;
create policy "Room chat visible to room participants"
  on public.study_room_messages for select to authenticated
  using (
    public.is_app_moderator()
    or exists (
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

-- ============ 20260812000017_database_housekeeping.sql ============
-- LearningFans: Database housekeeping for the free-tier cap
-- 1) get_table_sizes(): per-table size + row-count report (admin dashboard).
-- 2) run_housekeeping(): daily retention pruning — consumed moderation-queue
--    rows, read notifications, and sent meeting reminders are deleted. Old
--    chat messages + moderation logs are ARCHIVED (not deleted) by the app's
--    archive pipeline, which copies them to the separate archive project.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create or replace function public.get_table_sizes()
returns table (table_name text, size_bytes bigint, row_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    c.relname::text as table_name,
    pg_total_relation_size(c.oid)::bigint as size_bytes,
    coalesce(s.n_live_tup, 0)::bigint as row_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by size_bytes desc;
$$;

create or replace function public.run_housekeeping(
  p_queue_days int default 7,
  p_notification_days int default 30,
  p_reminder_days int default 30
)
returns table (action text, rows_removed bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue bigint;
  v_notifications bigint;
  v_reminders bigint;
begin
  -- Moderation queue rows are consumed once processed/failed — no reason to
  -- keep them (the message row itself carries the final state).
  delete from public.chat_moderation_queue
  where status in ('processed', 'failed')
    and coalesce(processed_at, created_at) < now() - make_interval(days => p_queue_days);
  get diagnostics v_queue = row_count;

  -- Read notifications are historical; keep unread ones for the bell.
  delete from public.notifications
  where read_at is not null
    and created_at < now() - make_interval(days => p_notification_days);
  get diagnostics v_notifications = row_count;

  -- Sent meeting reminders serve no purpose after delivery.
  delete from public.meeting_reminders
  where sent_at is not null
    and created_at < now() - make_interval(days => p_reminder_days);
  get diagnostics v_reminders = row_count;

  return query
    select 'chat_moderation_queue'::text, v_queue
    union all select 'notifications', v_notifications
    union all select 'meeting_reminders', v_reminders;
end;
$$;

-- ============ 20260813000001_parent_digests.sql ============
-- LearningFans: Monthly parent progress digest
-- A parent-facing summary of a student's activity, generated once per month by
-- the existing Monday cron (/api/cron/digest). Stores one row per student per
-- month (email-ready, like profanity_notifications), and pings the student via
-- the existing bell so they know a report was generated for their parent.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table if not exists public.parent_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_email text not null,
  period_start timestamptz not null,
  period_end timestamptz not null default now(),
  total_xp bigint not null default 0,
  xp_delta bigint,                     -- XP earned vs the previous digest (null on first)
  level int not null default 1,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  threads_created int not null default 0,
  materials_created int not null default 0,
  replies int not null default 0,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_parent_digests_user on public.parent_digests (user_id, created_at desc);
create index if not exists idx_parent_digests_status on public.parent_digests (status, created_at);

alter table public.parent_digests enable row level security;

drop policy if exists "Users view own parent digests" on public.parent_digests;
create policy "Users view own parent digests"
  on public.parent_digests for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Server manages parent digests" on public.parent_digests;
create policy "Server manages parent digests"
  on public.parent_digests for all to authenticated
  using (true) with check (true);

-- Generate a digest for every student with a parent_email set who studied in
-- the last 30 days, skipping anyone who already got one this month. Returns the
-- number of digests written.
create or replace function public.send_parent_digests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_prev_xp bigint;
  v_xp_delta bigint;
  v_threads int;
  v_materials int;
  v_replies int;
  v_sent int := 0;
  v_period_start timestamptz := now() - interval '30 days';
begin
  for v_student in
    select p.id as uid, p.display_name, p.parent_email,
           coalesce(us.total_xp, 0) as total_xp,
           coalesce(us.current_streak, 0) as current_streak,
           coalesce(us.longest_streak, 0) as longest_streak
    from public.profiles p
    left join public.user_stats us on us.user_id = p.id
    where p.parent_email is not null
      and p.parent_email <> ''
      and us.last_study_date is not null
      and us.last_study_date >= (now() at time zone 'utc')::date - 30
  loop
    -- At most one digest per student per rolling month.
    if exists (
      select 1 from public.parent_digests pd
      where pd.user_id = v_student.uid
        and pd.created_at > now() - interval '30 days'
    ) then
      continue;
    end if;

    -- XP trend: total now vs the student's most recent prior digest.
    select pd.total_xp
      into v_prev_xp
    from public.parent_digests pd
    where pd.user_id = v_student.uid
    order by pd.created_at desc
    limit 1;
    v_xp_delta := case when v_prev_xp is null then null else v_student.total_xp - v_prev_xp end;

    select count(*)
      into v_threads
    from public.threads t
    where t.author_id = v_student.uid
      and t.created_at > v_period_start
      and t.is_hidden = false;

    select count(*)
      into v_materials
    from public.study_materials m
    where m.author_id = v_student.uid
      and m.created_at > v_period_start
      and m.is_hidden = false;

    select count(*)
      into v_replies
    from public.posts p
    where p.author_id = v_student.uid
      and p.created_at > v_period_start
      and p.is_hidden = false;

    insert into public.parent_digests (
      user_id, parent_email, period_start, total_xp, xp_delta, level,
      current_streak, longest_streak, threads_created, materials_created,
      replies, body
    ) values (
      v_student.uid,
      v_student.parent_email,
      v_period_start,
      v_student.total_xp,
      v_xp_delta,
      public.xp_to_level(v_student.total_xp)::int,
      v_student.current_streak,
      v_student.longest_streak,
      v_threads,
      v_materials,
      v_replies,
      'LearningFans monthly progress for ' || v_student.display_name || E':\n'
        || '- Level ' || public.xp_to_level(v_student.total_xp)::int
        || ' · ' || v_student.total_xp || ' XP'
        || coalesce(' (+' || v_xp_delta || ' this month)', '') || E'\n'
        || '- Study streak: ' || v_student.current_streak || ' days'
        || ' (longest ' || v_student.longest_streak || ')' || E'\n'
        || '- Shared ' || v_threads || ' discussions, ' || v_materials
        || ' materials, and ' || v_replies || ' replies this month'
    );

    -- Ping the student through the existing bell.
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_student.uid,
      'parent_digest',
      'Your monthly progress report is ready',
      'A summary of your study progress was generated for your parent/guardian.',
      '/app/settings'
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;

-- ============ 20260813000002_room_moderation.sql ============
-- LearningFans: Room moderation (host kick/mute)
-- Hosts (room creator, app moderator, or space moderator) can mute or ban a
-- participant. Muted users can't post chat for the mute window; banned users
-- can't post chat or save the whiteboard until unbanned.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table if not exists public.study_room_moderation (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('mute', 'ban')),
  expires_at timestamptz, -- null = permanent (ban)
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists idx_study_room_moderation_room on public.study_room_moderation (room_id, action, expires_at);

alter table public.study_room_moderation enable row level security;

-- Visible to anyone who can see the room (so muted users see their own status,
-- and hosts see the full list).
drop policy if exists "Room moderation visible to participants" on public.study_room_moderation;
create policy "Room moderation visible to participants"
  on public.study_room_moderation for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_moderation.room_id
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

-- Only hosts/moderators can write moderation rows.
drop policy if exists "Hosts manage room moderation" on public.study_room_moderation;
create policy "Hosts manage room moderation"
  on public.study_room_moderation for all to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_moderation.room_id
        and (
          sr.created_by = auth.uid()
          or public.is_app_moderator()
          or (
            sr.space_id is not null
            and public.is_space_moderator(sr.space_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_moderation.room_id
        and (
          sr.created_by = auth.uid()
          or public.is_app_moderator()
          or (
            sr.space_id is not null
            and public.is_space_moderator(sr.space_id)
          )
        )
    )
  );

-- Hardened chat insert policy: replace the original "Users post in visible
-- rooms" policy so muted/banned participants can't bypass the app check by
-- writing directly to the table.
drop policy if exists "Users post in visible rooms" on public.study_room_messages;

drop policy if exists "Users post in visible rooms (unmuted)" on public.study_room_messages;
create policy "Users post in visible rooms (unmuted)"
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
    and not exists (
      select 1 from public.study_room_moderation mod
      where mod.room_id = study_room_messages.room_id
        and mod.user_id = auth.uid()
        and (
          mod.action = 'ban'
          or (mod.action = 'mute' and mod.expires_at is not null and mod.expires_at > now())
        )
    )
  );

-- ============ 20260813000003_ask_community.sql ============
-- LearningFans: "Ask the community" question posts + official answers
-- Threads gain a `kind` (discussion | question); questions carry a mandatory
-- `what_tried` field and an optional `accepted_answer_id` pointing at the
-- reply a moderator (or the author) marked as the official answer.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.threads
  add column if not exists kind text not null default 'discussion'
    check (kind in ('discussion', 'question'));

alter table public.threads
  add column if not exists what_tried text;

alter table public.threads
  add column if not exists accepted_answer_id uuid
    references public.posts (id) on delete set null;

create index if not exists idx_threads_kind
  on public.threads (kind, created_at desc);

-- ============ 20260813000004_study_parties.sql ============
-- LearningFans: Study parties (scheduled rooms + study-session minutes)
-- A study party is a study_room with a future starts_at. Study sessions are
-- recorded when a shared pomodoro focus block completes, and power the
-- "most minutes studied together this week" leaderboard.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.study_rooms
  add column if not exists starts_at timestamptz;

create index if not exists idx_study_rooms_starts
  on public.study_rooms (starts_at)
  where starts_at is not null;

-- One row per user per completed focus block in a room. focus_key dedupes the
-- shared broadcast (every client fires the same completion with the same key),
-- so a 25-minute block counts once per participant, not once per tab.
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  minutes int not null default 0,
  focus_key text not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id, focus_key)
);

create index if not exists idx_study_sessions_room_time on public.study_sessions (room_id, created_at desc);
create index if not exists idx_study_sessions_user_time on public.study_sessions (user_id, created_at desc);

alter table public.study_sessions enable row level security;

drop policy if exists "Participants view study sessions" on public.study_sessions;
create policy "Participants view study sessions"
  on public.study_sessions for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_sessions.room_id
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

drop policy if exists "Users record own study sessions" on public.study_sessions;
create policy "Users record own study sessions"
  on public.study_sessions for insert to authenticated
  with check (auth.uid() = user_id);

-- Weekly "most minutes studied together" leaderboard: rooms ranked by total
-- participant-minutes in the last N days. Security definer so the aggregate
-- isn't blocked by RLS.
create or replace function public.get_study_party_leaderboard(
  p_days int default 7,
  p_limit int default 5
)
returns table (
  room_id uuid,
  name text,
  total_minutes bigint,
  participants bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select ss.room_id,
         sr.name,
         coalesce(sum(ss.minutes), 0)::bigint as total_minutes,
         count(distinct ss.user_id)::bigint as participants
  from public.study_sessions ss
  join public.study_rooms sr on sr.id = ss.room_id
  where ss.created_at > now() - make_interval(days => p_days)
  group by ss.room_id, sr.name
  order by total_minutes desc, participants desc
  limit p_limit;
$$;

-- ============ 20260813000005_accountability_groups.sql ============
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

-- ============ 20260813000006_quiz_integrity.sql ============
-- LearningFans: Quiz integrity / cheating guard
-- Per-question answer-time fingerprints + flags for suspiciously-fast scores,
-- so the community leaderboard stays honest.
-- Apply in the Supabase SQL editor (idempotent).

alter table public.quiz_attempts
  add column if not exists total_ms int,
  add column if not exists answer_times_ms jsonb not null default '[]',
  add column if not exists flagged boolean not null default false,
  add column if not exists flag_reasons text[] not null default '{}';

-- ============ 20260813000007_party_rsvps.sql ============
-- LearningFans: Study party RSVPs + reminders
-- Attendees can RSVP to scheduled study parties and get a bell reminder
-- (pushed via the existing daily push cron) shortly before the start time.
-- `reminded_at` dedupes reminders (null until the first one goes out).
-- Apply in the Supabase SQL editor (idempotent).

create table if not exists public.study_room_rsvps (
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_study_room_rsvps_room on public.study_room_rsvps (room_id);

alter table public.study_room_rsvps enable row level security;

drop policy if exists "Anyone can view party RSVPs" on public.study_room_rsvps;
create policy "Anyone can view party RSVPs"
  on public.study_room_rsvps for select to authenticated
  using (true);

drop policy if exists "Users RSVP for upcoming parties" on public.study_room_rsvps;
create policy "Users RSVP for upcoming parties"
  on public.study_room_rsvps for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_rooms r
      where r.id = room_id
        and r.status = 'active'
        and r.starts_at is not null
        and r.starts_at > now()
    )
  );

drop policy if exists "Users remove own party RSVP" on public.study_room_rsvps;
create policy "Users remove own party RSVP"
  on public.study_room_rsvps for delete to authenticated
  using (auth.uid() = user_id);