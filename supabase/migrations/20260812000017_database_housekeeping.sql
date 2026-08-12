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
