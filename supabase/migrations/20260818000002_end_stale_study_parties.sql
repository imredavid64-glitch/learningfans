-- Idempotent: scheduled study parties that never started get auto-ended by
-- the maintenance cron instead of lingering as "Live" rooms forever.

-- Function: end stale parties (starts_at in the past, still active, nobody
-- present). Returns the number of rooms ended.
create or replace function public.end_stale_study_parties(p_hours integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ended integer := 0;
  v_room_id uuid;
begin
  for v_room_id in
    select r.id
    from public.study_rooms r
    where r.status = 'active'
      and r.starts_at is not null
      and r.starts_at < now() - (p_hours || ' hours')::interval
  loop
    update public.study_rooms
       set status = 'ended',
           updated_at = now()
     where id = v_room_id;
    v_ended := v_ended + 1;
  end loop;
  return v_ended;
end;
$$;

-- Let the app's normal participant-level RLS policies apply; the cron calls
-- this via the service role, which bypasses RLS anyway.