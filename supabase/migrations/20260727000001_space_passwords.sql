-- Add password protection to spaces
alter table public.spaces 
  add column if not exists join_password_hash text;

-- Update the can_read_space function to not require membership for viewing
create or replace function public.can_read_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space_id
      and (s.is_public or public.is_space_member(p_space_id))
  );
$$;
