-- LearningFans: Community branding + directory (Reddit Phase 2b round 2)
-- icon_url / banner_url store full public storage URLs; the community-assets
-- bucket is public for reads (directory page + headers render plain <img>) and
-- write-gated to space mods / app mods.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.spaces add column if not exists icon_url text;
alter table public.spaces add column if not exists banner_url text;

-- Public bucket: everyone may read, only mods may write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('community-assets', 'community-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Community assets are publicly readable" on storage.objects;
create policy "Community assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'community-assets');

drop policy if exists "Community mods upload assets" on storage.objects;
create policy "Community mods upload assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-assets'
    and (
      public.is_app_moderator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_space_moderator((storage.foldername(name))[1]::uuid)
      )
    )
  );

drop policy if exists "Community mods update assets" on storage.objects;
create policy "Community mods update assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-assets'
    and (
      public.is_app_moderator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_space_moderator((storage.foldername(name))[1]::uuid)
      )
    )
  );

drop policy if exists "Community mods delete assets" on storage.objects;
create policy "Community mods delete assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-assets'
    and (
      public.is_app_moderator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.is_space_moderator((storage.foldername(name))[1]::uuid)
      )
    )
  );

-- No new RLS on spaces: mods/creator/app-mods already update spaces (0006 + initial schema).
