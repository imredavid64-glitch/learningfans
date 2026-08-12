-- LearningFans: Community rules + moderator announcements (Reddit-style)
-- Rules and announcements live on the space row as small jsonb arrays — one row
-- per community, no new tables, free-tier friendly. The existing "Space
-- moderators can update spaces" RLS policy already gates writes.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces
  add column if not exists rules jsonb not null default '[]'::jsonb,
  add column if not exists announcements jsonb not null default '[]'::jsonb;

-- App moderators (global role) can also manage any community's rules/announcements.
create policy "App moderators can update spaces"
  on public.spaces for update to authenticated
  using (public.is_app_moderator());
