-- LearningFans: "Ask the community" question posts + official answers
-- Threads gain a `kind` (discussion | question); questions carry a mandatory
-- `what_tried` field and an optional `accepted_answer_id` pointing at the
-- reply a moderator (or the author) marked as the official answer.
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.threads
  add column if not exists kind text not null default 'discussion'
    check (kind in ('discussion', 'question'));

alter table public.threads
  add column if not exists what_tried text;

alter table public.threads
  add column if not exists accepted_answer_id uuid
    references public.posts (id) on delete set null;

create index if not exists idx_threads_kind
  on public.threads (kind, created_at desc);
