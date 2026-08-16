-- LearningFans: Nested (threaded) replies (Reddit-style comment chains)
-- posts gain a self-referencing parent_id; the reply trigger also notifies the
-- parent comment author (when they aren't the thread author or the replier).
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter table public.posts add column if not exists parent_id uuid references public.posts (id) on delete cascade;

create index if not exists idx_posts_thread_parent
  on public.posts (thread_id, parent_id);

create or replace function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
  v_author_name text;
  v_parent_author uuid;
begin
  select t.id, t.title, t.author_id, t.space_id, s.slug
    into v_thread
  from public.threads t
  join public.spaces s on s.id = t.space_id
  where t.id = new.thread_id;

  if v_thread.id is null then
    return new;
  end if;

  select display_name into v_author_name from public.profiles where id = new.author_id;

  -- Notify the thread author, but not when they reply to their own thread.
  if v_thread.author_id <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (
      v_thread.author_id,
      new.author_id,
      'reply',
      'New reply: ' || v_thread.title,
      coalesce(v_author_name, 'Someone') || ' replied to your discussion',
      '/app/spaces/' || v_thread.slug || '/threads/' || v_thread.id
    );
  end if;

  -- Nested replies: also notify the parent comment author (unless it's the
  -- thread author — already notified above — or the replier themselves).
  if new.parent_id is not null then
    select author_id into v_parent_author from public.posts where id = new.parent_id;
    if v_parent_author is not null
       and v_parent_author <> new.author_id
       and v_parent_author <> v_thread.author_id then
      insert into public.notifications (user_id, actor_id, type, title, body, link)
      values (
        v_parent_author,
        new.author_id,
        'reply',
        'New reply to your comment',
        coalesce(v_author_name, 'Someone') || ' replied to your comment in ' || v_thread.title,
        '/app/spaces/' || v_thread.slug || '/threads/' || v_thread.id
      );
    end if;
  end if;

  return new;
end;
$$;
