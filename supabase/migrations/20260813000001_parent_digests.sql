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

create policy "Users view own parent digests"
  on public.parent_digests for select to authenticated
  using (auth.uid() = user_id);

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
