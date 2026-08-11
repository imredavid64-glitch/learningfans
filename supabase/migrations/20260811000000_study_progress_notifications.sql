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
