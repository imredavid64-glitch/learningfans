-- LearningFans: user profiles (bio / major / interests) + broad file-type uploads
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

-- ------------------------------------------------------------------
-- Profiles: restore the missing student-profile columns (schema drift fix)
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists major text,
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists parent_email text,
  add column if not exists principal_email text,
  add column if not exists gpa numeric(3,2) default 0.00,
  add column if not exists current_class_id uuid references public.spaces (id) on delete set null,
  add column if not exists credits_completed int not null default 0;

-- Public (aggregate-only) stats snapshot for profile pages. RLS keeps
-- user_stats private, so expose just the gamification numbers via a
-- security-definer helper.
create or replace function public.get_public_stats(p_user_id uuid)
returns table (
  total_xp bigint,
  level int,
  current_streak int,
  longest_streak int
)
language sql
security definer
set search_path = public
stable
as $$
  select us.total_xp,
         public.xp_to_level(us.total_xp)::int as level,
         us.current_streak,
         us.longest_streak
  from public.user_stats us
  where us.user_id = p_user_id;
$$;

-- ------------------------------------------------------------------
-- Materials bucket: support many file types (docs, spreadsheets,
-- presentations, archives, audio, video) and a larger per-file cap.
-- ------------------------------------------------------------------
update storage.buckets
set file_size_limit = 15728640, -- 15 MB per file
    allowed_mime_types = array[
      -- Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/rtf',
      -- Plain text / code / data
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/html',
      'application/json',
      'application/xml',
      -- Archives
      'application/zip',
      'application/x-7z-compressed',
      'application/x-rar-compressed',
      'application/gzip',
      'application/x-tar',
      -- Images
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      -- Audio
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      -- Video
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-matroska'
    ]
where id = 'materials';