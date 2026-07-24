-- get_db_size: returns database size in bytes
create or replace function public.get_db_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

-- Run this SQL in the ARCHIVE Supabase project's SQL editor:
-- (the old project at xhximqrchwwwwwsysgdo.supabase.co)
--
-- CREATE TABLE public.archived_records (
--   id uuid primary key default gen_random_uuid(),
--   table_name text not null,
--   record_id uuid not null,
--   data jsonb not null,
--   archived_at timestamptz not null default now()
-- );
--
-- CREATE INDEX idx_archived_records_table ON public.archived_records (table_name, archived_at);
--
-- ALTER TABLE public.archived_records ENABLE ROW LEVEL SECURITY;
--
-- -- Only allow service role access
-- CREATE POLICY "Service role can manage archived records"
--   ON public.archived_records
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);
--
-- Also run the main schema migration (20260520100000_initial_schema.sql) on this project
