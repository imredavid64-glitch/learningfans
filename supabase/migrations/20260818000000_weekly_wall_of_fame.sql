-- LearningFans: Wall of Fame (weekly XP leaderboard)
-- `user_stats.weekly_xp` tracks XP earned in the current ISO week, reset
-- automatically when the week rolls over inside award_xp / check_in. The
-- `get_weekly_leaderboard` RPC ranks by this week's XP so the dashboard can
-- spotlight who's on fire right now (all-time rank stays on get_leaderboard).
-- Idempotent — safe to re-apply.

alter table public.user_stats
  add column if not exists weekly_xp bigint not null default 0,
  add column if not exists weekly_xp_week text;

-- Award XP with weekly tracking. Rewrites the batch version (same signature,
-- same behavior, plus the weekly accumulator that resets on week change).
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
  v_week text := to_char(now() at time zone 'utc', 'IYYY-IW');
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
    update public.user_stats set current_streak = 1, last_study_date = v_today
      where user_id = p_user_id;
    v_stats.current_streak := 1;
  elsif v_stats.last_study_date = v_today - 1 then
    update public.user_stats set current_streak = current_streak + 1, last_study_date = v_today
      where user_id = p_user_id;
    v_stats.current_streak := v_stats.current_streak + 1;
    v_bonus := 5 + least(v_stats.current_streak, 7);
    v_streak_incremented := true;
  end if;

  update public.user_stats
    set total_xp = total_xp + p_amount + v_bonus,
        weekly_xp = case
          when weekly_xp_week = v_week then weekly_xp + p_amount + v_bonus
          else p_amount + v_bonus
        end,
        weekly_xp_week = v_week,
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

-- Daily check-in also feeds the weekly total (same reset-on-week-change rule).
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
  v_week text := to_char(now() at time zone 'utc', 'IYYY-IW');
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
        weekly_xp = case
          when weekly_xp_week = v_week then weekly_xp + 5
          else 5
        end,
        weekly_xp_week = v_week,
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

-- Weekly leaderboard: this week's top XP earners (definer, since RLS hides
-- other users' stats).
create or replace function public.get_weekly_leaderboard(p_limit int default 10)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_xp bigint,
  level int,
  current_streak int,
  weekly_xp bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select us.user_id, p.display_name, p.avatar_url, us.total_xp,
         public.xp_to_level(us.total_xp) as level,
         us.current_streak, us.weekly_xp
  from public.user_stats us
  join public.profiles p on p.id = us.user_id
  where us.weekly_xp > 0
  order by us.weekly_xp desc
  limit p_limit;
$$;