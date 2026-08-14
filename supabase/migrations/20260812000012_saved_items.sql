-- LearningFans: Save / bookmark collections (Reddit "Saved" + folders)
-- Users collect threads and materials (including quizzes) into named folders.
-- item_id is polymorphic (thread vs material) — no FK, validated at the action
-- layer; each table is strictly user-owned via RLS.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

create table if not exists public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('thread', 'material')),
  item_id uuid not null,
  collection_id uuid references public.saved_collections (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create index if not exists idx_saved_items_user_created on public.saved_items (user_id, created_at desc);
create index if not exists idx_saved_items_collection on public.saved_items (collection_id);

alter table public.saved_collections enable row level security;
alter table public.saved_items enable row level security;

drop policy if exists "Users manage own saved collections" on public.saved_collections;
create policy "Users manage own saved collections"
  on public.saved_collections for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own saved items" on public.saved_items;
create policy "Users manage own saved items"
  on public.saved_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
