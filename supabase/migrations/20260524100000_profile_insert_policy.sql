-- Allow users to create their own profile if the signup trigger did not run
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);
