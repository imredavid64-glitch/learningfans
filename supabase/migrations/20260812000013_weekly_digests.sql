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
