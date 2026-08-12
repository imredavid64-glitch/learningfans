-- LearningFans: Interactive Study Rooms
-- Rooms people can join live: real-time whiteboard (broadcast), room chat
-- (postgres_changes realtime), presence, shared pomodoro, one-click video call.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'ended')),
  -- Serialized whiteboard strokes (jsonb array). Kept small on purpose:
  -- capped client-side (~256 KB) so the DB stays lean on the free tier.
  whiteboard jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_study_rooms_status on public.study_rooms (status, created_at desc);
create index idx_study_room_messages_room on public.study_room_messages (room_id, created_at);

alter table public.study_rooms enable row level security;
alter table public.study_room_messages enable row level security;

-- Rooms: anyone in the app can view global rooms; space rooms are limited to
-- space members (same model as meetings).
create policy "Study rooms viewable"
  on public.study_rooms for select to authenticated
  using (
    space_id is null
    or exists (
      select 1 from public.space_members
      where space_id = study_rooms.space_id and user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

create policy "Users create study rooms"
  on public.study_rooms for insert to authenticated
  with check (
    auth.uid() = created_by
    and not public.is_suspended()
    and (
      space_id is null
      or exists (
        select 1 from public.space_members
        where space_id = study_rooms.space_id and user_id = auth.uid()
      )
    )
  );

-- Collaborative whiteboard: any participant who can see the room may save
-- strokes / clear the board. Ending the room is limited to the creator or a
-- space/app moderator below.
create policy "Participants update study room whiteboard"
  on public.study_rooms for update to authenticated
  using (
    status = 'active'
    and (
      space_id is null
      or exists (
        select 1 from public.space_members
        where space_id = study_rooms.space_id and user_id = auth.uid()
      )
      or created_by = auth.uid()
    )
  );

create policy "Creators or moderators end study rooms"
  on public.study_rooms for update to authenticated
  using (created_by = auth.uid() or public.is_app_moderator());

create policy "Creators or moderators delete study rooms"
  on public.study_rooms for delete to authenticated
  using (created_by = auth.uid() or public.is_app_moderator());

-- Chat messages
create policy "Room chat visible to room participants"
  on public.study_room_messages for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_messages.room_id
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

create policy "Users post in visible rooms"
  on public.study_room_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_messages.room_id
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

create policy "Users delete own room messages"
  on public.study_room_messages for delete to authenticated
  using (auth.uid() = user_id);

-- Live chat via realtime
alter publication supabase_realtime add table public.study_room_messages;
