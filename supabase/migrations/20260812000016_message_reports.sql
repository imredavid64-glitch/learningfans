-- LearningFans: Per-message reports in room chat
-- 1) report_target_type gains 'message' so users can report chat messages.
-- 2) App moderators can read room chat messages (even space-linked rooms)
--    so the mod queue can show the reported message when reviewing it.
-- Apply this in the Supabase SQL editor: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new

alter type public.report_target_type add value if not exists 'message';

drop policy if exists "Room chat visible to room participants"
  on public.study_room_messages;
create policy "Room chat visible to room participants"
  on public.study_room_messages for select to authenticated
  using (
    public.is_app_moderator()
    or exists (
      select 1 from public.study_rooms sr
      where sr.id = study_room_messages.room_id
        and (
          sr.space_id is null
          or exists (
            select 1 from public.space_members
            where space_id = sr.space_id and user_id = auth.uid()
          )
          or sr.created_by = auth.uid()
        )
    )
  );
