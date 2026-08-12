-- LearningFans: Mod dashboard + automod rules
-- 1) spaces.automod_rules: mod-defined keyword rules ('flag' or 'remove',
--    scoped to threads / posts / all), enforced in the server actions.
-- 2) moderation_actions.space_id: lets each community show its own mod log.
-- 3) Policies: space moderators may read their community's log, and the
--    automod/AI-flag pipeline may log auto_flag rows (previously the insert
--    policy blocked non-app-mods, so auto-flags were silently dropped).
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces add column if not exists automod_rules jsonb not null default '[]'::jsonb;

alter table public.moderation_actions
  add column if not exists space_id uuid references public.spaces (id) on delete cascade;

create index if not exists idx_moderation_actions_space
  on public.moderation_actions (space_id, created_at desc);

-- Space moderators can read their community's mod log (app mods already could).
drop policy if exists "Space mods view community moderation log"
  on public.moderation_actions;
create policy "Space mods view community moderation log"
  on public.moderation_actions for select to authenticated
  using (
    public.is_app_moderator()
    or (
      space_id is not null
      and public.is_space_moderator(space_id)
    )
  );

-- Let the automod / AI-flag pipeline log auto_flag rows (system-initiated,
-- attributed to the content author), while keeping manual mod actions to app
-- moderators.
drop policy if exists "Mods insert moderation log"
  on public.moderation_actions;
create policy "Mods insert moderation log"
  on public.moderation_actions for insert to authenticated
  with check (
    auth.uid() = actor_id
    and (
      public.is_app_moderator()
      or action = 'auto_flag'
    )
  );
