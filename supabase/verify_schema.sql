-- Run this in Supabase SQL Editor to check if LearningFans schema is already applied.
-- If all rows show exists = true, you do NOT need to run initial_schema.sql again.

select
  'profiles' as object_name,
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) as exists
union all
select 'spaces', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'spaces'
)
union all
select 'study_materials', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'study_materials'
)
union all
select 'schedule_events', exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'schedule_events'
);
