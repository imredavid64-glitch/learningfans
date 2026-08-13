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
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  minutes int not null default 0,
  focus_key text not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id, focus_key)
);

create index idx_study_sessions_room_time on public.study_sessions (room_id, created_at desc);
create index idx_study_sessions_user_time on public.study_sessions (user_id, created_at desc);

alter table public.study_sessions enable row level security;

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
