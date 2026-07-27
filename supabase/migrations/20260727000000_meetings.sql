create type public.meeting_status as enum ('scheduled', 'live', 'completed', 'cancelled');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  call_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  status public.meeting_status not null default 'scheduled',
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_participants (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rsvp_status text not null default 'pending',
  invited_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table public.meeting_reminders (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reminder_text text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_meetings_space on public.meetings (space_id, starts_at);
create index idx_meetings_organizer on public.meetings (organizer_id, starts_at);
create index idx_meeting_participants_user on public.meeting_participants (user_id);
create index idx_meeting_reminders_pending on public.meeting_reminders (scheduled_for) where sent_at is null;

alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_reminders enable row level security;

-- Meetings policies
create policy "Meetings readable by space members"
  on public.meetings for select to authenticated
  using (
    space_id is null
    or exists (
      select 1 from public.space_members
      where space_id = meetings.space_id and user_id = auth.uid()
    )
    or organizer_id = auth.uid()
  );

create policy "Members can create meetings"
  on public.meetings for insert to authenticated
  with check (
    auth.uid() = organizer_id
    and not public.is_suspended()
    and (
      space_id is null
      or exists (
        select 1 from public.space_members
        where space_id = meetings.space_id and user_id = auth.uid()
      )
    )
  );

create policy "Organizers can update meetings"
  on public.meetings for update to authenticated
  using (organizer_id = auth.uid() or public.is_app_moderator());

create policy "Organizers can delete meetings"
  on public.meetings for delete to authenticated
  using (organizer_id = auth.uid() or public.is_app_moderator());

-- Participants policies
create policy "Participants visible to meeting members"
  on public.meeting_participants for select to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.organizer_id = auth.uid() or m.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = m.space_id and user_id = auth.uid()
          ))
    )
  );

create policy "Users can RSVP"
  on public.meeting_participants for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own RSVP"
  on public.meeting_participants for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can remove own RSVP"
  on public.meeting_participants for delete to authenticated
  using (auth.uid() = user_id);

-- Reminders policies
create policy "Recipients can view own reminders"
  on public.meeting_reminders for select to authenticated
  using (recipient_id = auth.uid() or auth.uid() in (
    select organizer_id from public.meetings where id = meeting_id
  ));

create policy "Server can insert reminders"
  on public.meeting_reminders for insert to authenticated
  with check (true);

create policy "Server can update reminders"
  on public.meeting_reminders for update to authenticated
  using (true);
