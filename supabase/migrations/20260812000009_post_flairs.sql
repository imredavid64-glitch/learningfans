-- LearningFans: Post flairs (Reddit-for-learners Phase 2b)
-- Mod-defined, color-coded post labels per community ("Homework help",
-- "Exam prep", "Resource", ...). Flairs live as jsonb on spaces (same pattern
-- as rules/announcements); threads reference one by id.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces add column if not exists flairs jsonb not null default '[]'::jsonb;
alter table public.threads add column if not exists flair_id text;

create index if not exists idx_threads_space_flair
  on public.threads (space_id, flair_id)
  where flair_id is not null;

-- No new RLS needed: spaces updates are already mod-gated (community_rules
-- migration), and threads updates already allow authors + space/app mods.
