-- Schools table for multi-tenant architecture
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  subdomain text not null unique,
  status text not null default 'provisioning',
  owner_id uuid references public.profiles (id) on delete set null,
  supabase_project_ref text,
  supabase_url text,
  supabase_anon_key text,
  supabase_service_role_key text,
  region text not null default 'us-east-1',
  plan text not null default 'free',
  ai_agent_enabled boolean not null default true,
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schools_slug on public.schools (slug);
create index idx_schools_subdomain on public.schools (subdomain);
create index idx_schools_owner on public.schools (owner_id);

alter table public.schools enable row level security;

create policy "Schools visible to all authenticated"
  on public.schools for select to authenticated using (true);

create policy "Admins can insert schools"
  on public.schools for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update schools"
  on public.schools for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can delete schools"
  on public.schools for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
