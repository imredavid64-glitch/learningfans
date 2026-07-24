-- Audit log table
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  ip_address text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_audit_log_user on public.audit_log (user_id, created_at desc);
create index idx_audit_log_action on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

-- Only app moderators/admins can view audit logs
create policy "Mods can view audit logs"
  on public.audit_log for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('moderator', 'admin')
    )
  );

-- Service role (server-side) can insert audit logs
create policy "Server can insert audit logs"
  on public.audit_log for insert to authenticated
  with check (true);

-- Rate limit the profile update to prevent abuse
create or replace function public.check_update_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.updated_at is not null and old.updated_at > now() - interval '10 seconds' then
    raise exception 'Please wait before updating your profile again';
  end if;
  return new;
end;
$$;

-- Add updated_at to profiles if not present
alter table public.profiles add column if not exists updated_at timestamptz;

create trigger on_profile_update_rate
  before update on public.profiles
  for each row execute function public.check_update_rate();

-- Sanitize display_name on insert
create or replace function public.sanitize_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.display_name := regexp_replace(new.display_name, '[<>&"''/]', '', 'g');
  return new;
end;
$$;

create trigger on_profile_sanitize_name
  before insert or update on public.profiles
  for each row execute function public.sanitize_display_name();
