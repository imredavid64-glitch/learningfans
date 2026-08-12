-- ============================================================
-- LearningFans: ONE-OFF backfill — room chat history → AI moderation
--
-- Enqueues every existing chat message that was never AI-reviewed into
-- chat_moderation_queue, so the batched moderation pipeline (one Groq
-- request per 15 messages) reviews them exactly like new sends.
--
-- Idempotent: NOT EXISTS skips any message already in the queue (pending,
-- processing, processed or failed), so re-running is safe. Already-hidden
-- messages are skipped (they're already dealt with).
--
-- Paste into: https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new
-- Run once. The SQL editor reports how many rows were enqueued.
--
-- Processing happens automatically: the next chat message send triggers a
-- flush, and the daily push cron drains one chunk as a safety net. To drain
-- a large backlog immediately instead of waiting, run (after deploy):
--   curl -X POST "https://learningfans.vercel.app/api/moderation/chat?chunks=20" \
--        -H "Authorization: Bearer $CRON_SECRET"
-- (chunks × 15 messages per call; 20 chunks ≈ 300 messages.)
-- ============================================================

insert into public.chat_moderation_queue (message_id, room_id, user_id, content)
select m.id, m.room_id, m.user_id, m.body
from public.study_room_messages m
where m.hidden = false
  and not exists (
    select 1 from public.chat_moderation_queue q
    where q.message_id = m.id
  );
