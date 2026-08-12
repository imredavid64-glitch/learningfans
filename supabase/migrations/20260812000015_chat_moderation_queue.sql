-- LearningFans: Batched AI moderation for room chat
-- 1) chat_moderation_queue: messages awaiting AI review. The server action
--    inserts instantly (fast local checks only) and a background batch route
--    claims rows in chunks, sends them to Groq in ONE request, and hides +
--    logs anything high-risk. No per-message latency on the send path.
-- 2) study_room_messages.hidden: set by the moderation pipeline for flagged
--    messages so the client can render a "removed" placeholder.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.study_room_messages
  add column if not exists hidden boolean not null default false;

create table if not exists public.chat_moderation_queue (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.study_room_messages (id) on delete cascade,
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  status text not null default 'pending',      -- pending | processing | processed | failed
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_chat_moderation_queue_status
  on public.chat_moderation_queue (status, created_at);

alter table public.chat_moderation_queue enable row level security;

-- Atomic claim: flips pending rows to processing (bumping attempts) and
-- returns them, so concurrent flushes never process the same row twice.
create or replace function public.claim_chat_moderation_batch(p_limit int)
returns setof public.chat_moderation_queue
language sql
security definer
set search_path = public
as $$
  update public.chat_moderation_queue
  set status = 'processing', attempts = attempts + 1
  where id in (
    select id from public.chat_moderation_queue
    where status = 'pending'
    order by created_at
    limit p_limit
  )
  returning *;
$$;

-- Only the send path inserts (with the authenticated user's own id); the
-- batch route drains with the service role. Users never read or mutate the
-- queue directly.
drop policy if exists "Users enqueue their own chat messages"
  on public.chat_moderation_queue;
create policy "Users enqueue their own chat messages"
  on public.chat_moderation_queue for insert to authenticated
  with check (auth.uid() = user_id);
