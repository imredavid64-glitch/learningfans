-- Run this in Supabase SQL Editor to check if the LearningFans schema is applied.
-- If every row shows exists = true, all migrations have been applied and you are
-- done. If any row is false, apply the matching migration file and re-run.

select
  'profiles' as object_name,
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') as exists
union all
select 'spaces', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spaces')
union all
select 'space_members', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'space_members')
union all
select 'threads', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'threads')
union all
select 'posts', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'posts')
union all
select 'study_materials', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'study_materials')
union all
select 'user_material_rankings', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_material_rankings')
union all
select 'schedule_events', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'schedule_events')
union all
select 'meetings', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'meetings')
union all
select 'meeting_participants', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'meeting_participants')
union all
select 'meeting_reminders', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'meeting_reminders')
union all
select 'notifications', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications')
union all
select 'user_stats', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_stats')
union all
select 'push_subscriptions', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'push_subscriptions')
union all
select 'study_rooms', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'study_rooms')
union all
select 'study_room_messages', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'study_room_messages')
order by object_name;
