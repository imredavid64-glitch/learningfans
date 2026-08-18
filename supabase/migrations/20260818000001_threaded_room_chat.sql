-- LearningFans: Threaded room chat
-- `study_room_messages.parent_id` lets participants reply to a specific
-- message; replies nest under their parent in the room-chat tree (depth capped
-- at 3 client-side). No RLS change: the existing room-visibility policies cover
-- selects/inserts, and a reply can only target a message the writer can see.
-- Idempotent — safe to re-apply.

alter table public.study_room_messages
  add column if not exists parent_id uuid
  references public.study_room_messages (id) on delete cascade;

create index if not exists idx_study_room_messages_parent
  on public.study_room_messages (parent_id);