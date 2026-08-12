-- LearningFans: Thread upvotes/downvotes (Reddit-style)
-- A single post_votes table (one row per user per post) + cached score columns
-- on threads, maintained by a trigger so sorting stays cheap and consistent.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.threads
  add column if not exists score int not null default 0,
  add column if not exists ups int not null default 0,
  add column if not exists downs int not null default 0;

create table public.post_votes (
  post_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index idx_post_votes_user on public.post_votes (user_id);

alter table public.post_votes enable row level security;

create policy "Votes visible to thread readers"
  on public.post_votes for select to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = post_id
        and public.can_read_space(t.space_id)
        and (t.is_hidden = false or public.is_app_moderator())
    )
  );

create policy "Readers can vote on threads"
  on public.post_votes for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.threads t
      where t.id = post_id
        and public.can_read_space(t.space_id)
        and t.is_hidden = false
    )
  );

create policy "Users update own votes"
  on public.post_votes for update to authenticated
  using (auth.uid() = user_id);

create policy "Users delete own votes"
  on public.post_votes for delete to authenticated
  using (auth.uid() = user_id);

-- Recompute the cached score/ups/downs whenever a vote changes. Recomputing
-- (rather than incrementing) keeps the trigger idempotent and race-safe.
create or replace function public.update_thread_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid := coalesce(new.post_id, old.post_id);
begin
  update public.threads t
  set ups = v.ups,
      downs = v.downs,
      score = v.ups - v.downs
  from (
    select
      count(*) filter (where vote = 1) as ups,
      count(*) filter (where vote = -1) as downs
    from public.post_votes
    where post_id = v_thread
  ) v
  where t.id = v_thread;
  return coalesce(new, old);
end;
$$;

create trigger on_post_vote_changed
  after insert or update or delete on public.post_votes
  for each row execute function public.update_thread_score();
