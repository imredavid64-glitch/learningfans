-- LearningFans: Emoji reactions on study room chat messages
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table if not exists public.study_room_message_reactions (
  message_id uuid not null references public.study_room_messages (id) on delete cascade,
  -- Denormalized so realtime can filter per-room (postgres_changes supports
  -- simple column filters only).
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists idx_study_room_reactions_room on public.study_room_message_reactions (room_id, created_at);

alter table public.study_room_message_reactions enable row level security;

drop policy if exists "Reactions visible to room participants" on public.study_room_message_reactions;
create policy "Reactions visible to room participants"
  on public.study_room_message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_message_reactions.room_id
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );

drop policy if exists "Users react in visible rooms" on public.study_room_message_reactions;
create policy "Users react in visible rooms"
  on public.study_room_message_reactions for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_message_reactions.room_id
        and sr.status = 'active'
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );

drop policy if exists "Users remove own reactions" on public.study_room_message_reactions;
create policy "Users remove own reactions"
  on public.study_room_message_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- Live reactions via realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_room_message_reactions'
  ) then
    alter publication supabase_realtime add table public.study_room_message_reactions;
  end if;
end $$;
