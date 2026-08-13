-- LearningFans: Quiz integrity / cheating guard
-- Per-question answer-time fingerprints + flags for suspiciously-fast scores,
-- so the community leaderboard stays honest.
-- Apply in the Supabase SQL editor (idempotent).

alter table public.quiz_attempts
  add column if not exists total_ms int,
  add column if not exists answer_times_ms jsonb not null default '[]',
  add column if not exists flagged boolean not null default false,
  add column if not exists flag_reasons text[] not null default '{}';
