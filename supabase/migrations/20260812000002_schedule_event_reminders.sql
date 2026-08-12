-- LearningFans: Schedule event reminders
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Mirrors the meeting_reminders table: rows are generated when an event is
-- created (owner + RSVP'd attendees) and delivered by the in-app notifier.

create table public.schedule_event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reminder_text text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_schedule_event_reminders_pending
  on public.schedule_event_reminders (scheduled_for)
  where sent_at is null;

alter table public.schedule_event_reminders enable row level security;

create policy "Recipients view own event reminders"
  on public.schedule_event_reminders for select to authenticated
  using (recipient_id = auth.uid());

create policy "Server can insert event reminders"
  on public.schedule_event_reminders for insert to authenticated
  with check (true);

create policy "Server can update event reminders"
  on public.schedule_event_reminders for update to authenticated
  using (true);
