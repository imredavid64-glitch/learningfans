-- Safe to run if you already applied the main migration but missed this policy.
-- Ignores error if policy already exists.

do $$
begin
  create policy "Users can insert own profile"
    on public.profiles for insert to authenticated
    with check (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;
