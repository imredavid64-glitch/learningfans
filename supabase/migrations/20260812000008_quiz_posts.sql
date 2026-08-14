-- LearningFans: Quiz posts (Reddit-for-learners Phase 3a)
-- Quizzes are study_materials of type 'quiz' (payload in metadata.questions);
-- quiz_attempts keeps ONE row per user per quiz with the best score, so the
-- community leaderboard stays lean on the free tier.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter type public.material_type add value if not exists 'quiz';

create table if not exists public.quiz_attempts (
  material_id uuid not null references public.study_materials (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  best_score_pct int not null check (best_score_pct between 0 and 100),
  best_correct int not null default 0,
  best_total int not null default 0,
  attempts int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (material_id, user_id)
);

create index if not exists idx_quiz_attempts_leaderboard on public.quiz_attempts (material_id, best_score_pct desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "Quiz scores visible to material readers" on public.quiz_attempts;
create policy "Quiz scores visible to material readers"
  on public.quiz_attempts for select to authenticated
  using (
    exists (
      select 1 from public.study_materials sm
      where sm.id = material_id
        and public.can_read_space(sm.space_id)
        and (sm.is_hidden = false or public.is_app_moderator())
    )
  );

drop policy if exists "Users record own quiz attempts" on public.quiz_attempts;
create policy "Users record own quiz attempts"
  on public.quiz_attempts for insert to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_suspended()
    and exists (
      select 1 from public.study_materials sm
      where sm.id = material_id
        and public.can_read_space(sm.space_id)
        and sm.is_hidden = false
    )
  );

drop policy if exists "Users update own quiz attempts" on public.quiz_attempts;
create policy "Users update own quiz attempts"
  on public.quiz_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
