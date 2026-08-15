-- LearningFans: Notify thread authors when someone replies
-- Apply in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Mirrors the existing notify_new_thread / notify_new_material triggers.

create or replace function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
  v_author_name text;
begin
  select t.id, t.title, t.author_id, t.space_id, s.slug
    into v_thread.id, v_thread.title, v_thread.author_id, v_thread.space_id, v_thread.slug
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

  return new;
end;
$$;

drop trigger if exists on_new_post_notify on public.posts;
create trigger on_new_post_notify
  after insert on public.posts
  for each row execute function public.notify_new_post();
