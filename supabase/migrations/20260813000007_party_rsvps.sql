-- LearningFans: Study party RSVPs + reminders
-- Attendees can RSVP to scheduled study parties and get a bell reminder
-- (pushed via the existing daily push cron) shortly before the start time.
-- `reminded_at` dedupes reminders (null until the first one goes out).
-- Apply in the Supabase SQL editor (idempotent).

create table if not exists public.study_room_rsvps (
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_study_room_rsvps_room on public.study_room_rsvps (room_id);

alter table public.study_room_rsvps enable row level security;

drop policy if exists "Anyone can view party RSVPs" on public.study_room_rsvps;
create policy "Anyone can view party RSVPs"
  on public.study_room_rsvps for select to authenticated
  using (true);

drop policy if exists "Users RSVP for upcoming parties" on public.study_room_rsvps;
create policy "Users RSVP for upcoming parties"
  on public.study_room_rsvps for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_rooms r
      where r.id = room_id
        and r.status = 'active'
        and r.starts_at is not null
        and r.starts_at > now()
    )
  );

drop policy if exists "Users remove own party RSVP" on public.study_room_rsvps;
create policy "Users remove own party RSVP"
  on public.study_room_rsvps for delete to authenticated
  using (auth.uid() = user_id);
