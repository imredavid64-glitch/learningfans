-- LearningFans: Web push subscriptions
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Stores browser Push API subscriptions (VAPID, no Firebase needed) for PWA/browser delivery.
-- The native iOS/Android apps need the Capacitor Push plugin + FCM/APNs separately.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index idx_push_subscriptions_user on public.push_subscriptions (user_id);

-- Mark which notifications have already been pushed, so the cron is idempotent.
alter table public.notifications add column if not exists push_sent_at timestamptz;

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
