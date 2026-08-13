-- LearningFans: Room moderation (host kick/mute)
-- Hosts (room creator, app moderator, or space moderator) can mute or ban a
-- participant. Muted users can't post chat for the mute window; banned users
-- can't post chat or save the whiteboard until unbanned.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table public.study_room_moderation (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('mute', 'ban')),
  expires_at timestamptz, -- null = permanent (ban)
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index idx_study_room_moderation_room on public.study_room_moderation (room_id, action, expires_at);

alter table public.study_room_moderation enable row level security;

-- Visible to anyone who can see the room (so muted users see their own status,
-- and hosts see the full list).
create policy "Room moderation visible to participants"
  on public.study_room_moderation for select to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_moderation.room_id
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

-- Only hosts/moderators can write moderation rows.
create policy "Hosts manage room moderation"
  on public.study_room_moderation for all to authenticated
  using (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_moderation.room_id
        and (
          sr.created_by = auth.uid()
          or public.is_app_moderator()
          or (
            sr.space_id is not null
            and public.is_space_moderator(sr.space_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_moderation.room_id
        and (
          sr.created_by = auth.uid()
          or public.is_app_moderator()
          or (
            sr.space_id is not null
            and public.is_space_moderator(sr.space_id)
          )
        )
    )
  );

-- Hardened chat insert policy: replace the original "Users post in visible
-- rooms" policy so muted/banned participants can't bypass the app check by
-- writing directly to the table.
drop policy if exists "Users post in visible rooms" on public.study_room_messages;

create policy "Users post in visible rooms (unmuted)"
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
    and not exists (
      select 1 from public.study_room_moderation mod
      where mod.room_id = study_room_messages.room_id
        and mod.user_id = auth.uid()
        and (
          mod.action = 'ban'
          or (mod.action = 'mute' and mod.expires_at is not null and mod.expires_at > now())
        )
    )
  );
