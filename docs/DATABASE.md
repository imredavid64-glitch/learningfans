# Database

Supabase Postgres on project `xhximqrchwwwwwsysgdo`. All schema lives in
`supabase/migrations/*.sql` (applied in filename order) and can be verified with
`supabase/verify_schema.sql`. For a one-shot fresh install, paste
`supabase/migrations/combined.sql`.

## RLS model (the security backbone)

**Row Level Security is enabled on every table.** The core helpers (defined in
the initial schema, reused by every policy):

| Function | Purpose |
|----------|---------|
| `is_app_moderator()` | profile role is `moderator` or `admin` |
| `is_suspended()` | profile restriction level is `suspended` |
| `is_muted()` | profile restriction level is `muted`/`restricted` |
| `is_space_member(space_id)` / `is_space_moderator(space_id)` | membership checks |
| `can_read_space(space_id)` | member or public space |

Patterns repeated across policies:

- **Space-scoped content** (`threads`, `posts`, `study_materials`, `meetings`,
  `schedule_events`, `study_rooms`): readable by space members; private (global)
  rows readable by all authenticated users; writes require membership + not
  suspended; creators get update/delete.
- **Personal data** (`user_stats`, `notifications`, `meeting_reminders`,
  `user_material_rankings`, `push_subscriptions`): user_id = `auth.uid()`.
- **Collaborative rooms**: whiteboard updates are open to any participant who can
  read the room; ending/deleting is creator-or-moderator only.
- **Moderation**: moderators get cross-user visibility via `security definer`
  functions rather than broad RLS.

## Tables (33)

### Identity & spaces

| Table | Purpose |
|-------|---------|
| `profiles` | Users. `role` (`student`/`moderator`/`admin`), display_name, avatar, storage_used_bytes, restriction_level + profanity counters (escalation), school fields |
| `spaces` | Study groups/courses. `name`, `slug`, `is_public`, `join_password_hash` (optional password), description, **`rules` jsonb** (community rules, mod-editable), **`announcements` jsonb** (moderator announcements) |
| `space_members` | Membership + role (`member`/`moderator`) |
| `schools`, `class_enrollments`, `grades` | School-tenant provisioning (multi-tenant migrations) |

### Discussion & materials

| Table | Purpose |
|-------|---------|
| `threads` | Discussion threads; `is_pinned`, `is_locked`, `is_hidden`, `flair_id` (references a flair from the space's flairs), cached vote counts `score` / `ups` / `downs` |
| `post_votes` | Thread votes (PK post+user, `vote` 1/-1); maintains `threads.score/ups/downs` via the `update_thread_score` trigger |
| `posts` | Thread replies; `parent_id` self-reference for nested (threaded) replies; realtime publication |
| `study_materials` | `type` = file/link/note/flashcard_set/quiz; `metadata` jsonb (deck payloads, quiz questions, due dates); `community_score` |
| `quiz_attempts` | One best-score row per user per quiz (PK material+user) — feeds the community leaderboard |
| `user_material_rankings` | Per-user priority (`urgent/high/normal/low`), rank_score, due_at |
| `material_tags`, `tags`, `material_upvotes`, `reactions`, `material_priorities` | Early-schema tags/upvotes — largely legacy, kept for compatibility |

### Schedule & meetings

| Table | Purpose |
|-------|---------|
| `schedule_events` | Personal + space events; `visibility` private/space; `reminder_minutes_before` |
| `schedule_event_reminders` | Per-attendee due reminders for events |
| `event_attendees` | RSVPs for events |
| `meetings` | Scheduled calls; `status` scheduled/live/completed/cancelled; auto `call_url` (Jitsi) |
| `meeting_participants` | Invites + RSVP status |
| `meeting_reminders` | AI-generated reminders, delivered by the meeting-reminder notifier |

### Study rooms (collaboration)

| Table | Purpose |
|-------|---------|
| `study_rooms` | `name`, `description`, `status` (active/ended), `whiteboard` jsonb snapshot, `space_id` (nullable) |
| `study_room_messages` | Room chat (realtime publication) |
| `study_room_message_reactions` | Emoji reactions (PK message+user+emoji; denormalized `room_id` for realtime filtering) |

### Engagement, notifications & moderation

| Table | Purpose |
|-------|---------|
| `user_stats` | XP, streak (current/longest), last/daily study dates |
| `notifications` | Bell feed; types: material, thread, reply, mention, meeting, event, streak, system |
| `push_subscriptions` | Web Push (VAPID) subscriptions; `push_sent_at` idempotency |
| `reports` | Moderation reports (thread/post/material/profile) |
| `user_sanctions` | warn / mute / suspend with expiry |
| `moderation_actions` | Audit of moderator actions; `space_id` scopes per-community mod logs; automod/AI auto_flags are logged by the author (new insert policy) |
| `profanity_incidents`, `profanity_notifications` | Profanity escalation ledger |
| `audit_log` | Audit trail (class/moderator events) |
| `storage_objects` | Storage metadata mirror |
| `saved_collections` | User bookmark folders (user-owned RLS) |
| `saved_items` | Saved threads/materials (polymorphic `item_type`, PK user+type+item; folder FK set-null) |

## RPC functions (26)

### Auth & access (used by RLS)
`is_app_moderator`, `is_space_member`, `is_space_moderator`, `can_read_space`,
`is_suspended`, `is_muted`, `is_profanity_restricted`, `get_profanity_status`,
`sanitize_display_name`, `check_update_rate` (rate limiting)

### Gamification
`award_xp(user_id, amount, reason)` — awards XP + rolls streaks forward,
returns fresh stats · `check_in(user_id)` — daily +5 XP, keeps streak alive ·
`get_leaderboard(limit)` · `xp_to_level(xp)`

### Notifications
`create_notification(user, title, body, type, link, actor)` — security-definer
insert used by server actions (e.g. room @mentions)

### Triggers (security definer, auto-notify)
`notify_new_material`, `notify_new_thread`, `notify_new_post`,
`notify_new_meeting` — insert `notifications` rows for space members

### Profanity escalation
`handle_profanity_escalation(user, content, words, context_type, context_id)` —
warns → restricts → suspends based on repeat violations

### Misc
`get_db_size` — free-tier DB size probe (drives archival) ·
`get_table_sizes` — per-table size + row-count report (admin dashboard) ·
`run_housekeeping` — retention pruning (consumed moderation-queue rows 7d,
read notifications 30d, sent meeting reminders 30d; called by the daily cron) ·
`update_storage_used` · `update_material_upvote_score` · `handle_new_user` ·
`send_weekly_digests` — one `digest` notification per user per week from the
`/api/cron/digest` cron (counts new threads/materials/replies in their
communities, skips no-activity weeks)

## Realtime publication

`alter publication supabase_realtime add table` for:

- `posts` (thread replies)
- `threads`
- `notifications` (bell)
- `study_room_messages` (room chat)
- `study_room_message_reactions` (reactions)

## Migrations index

| File | Contents |
|------|----------|
| `20260520100000_initial_schema.sql` | Core schema: profiles, spaces, members, threads, posts, materials, rankings, schedule, reports, sanctions, RLS helpers |
| `20260524100000_profile_insert_policy.sql` / `20260528100000_profile_insert_policy_only.sql` | Profile insert policy variants |
| `20260715000000_security.sql` | Security hardening |
| `20260720000000_archive_security.sql` | Archival + storage security |
| `20260727000000_meetings.sql` | Meetings + participants + reminders |
| `20260727000001_space_passwords.sql` | `join_password_hash` |
| `20260728000000_multi_tenant_schools.sql` | Schools/classes/grades provisioning |
| `20260807000000_profanity_escalation.sql` | Profanity escalation pipeline |
| `20260811000000_study_progress_notifications.sql` | user_stats, notifications, RPCs, triggers |
| `20260812000001_reply_notifications.sql` | Post-reply notifications trigger |
| `20260812000002_schedule_event_reminders.sql` | Event reminders |
| `20260812000003_push_subscriptions.sql` | Web push subscriptions |
| `20260812000004_study_rooms.sql` | Study rooms + chat |
| `20260812000005_study_room_reactions.sql` | Message reactions |
| `20260812000006_community_rules.sql` | `spaces.rules` + `spaces.announcements` jsonb columns; app-moderator space update policy |
| `20260812000007_thread_votes.sql` | `threads.score/ups/downs` + `post_votes` table (RLS + realtime-less), `update_thread_score` trigger |
| `20260812000008_quiz_posts.sql` | `material_type` gains `quiz`; `quiz_attempts` table (PK material+user, best-score RLS, leaderboard index) |
| `20260812000009_post_flairs.sql` | `spaces.flairs` jsonb + `threads.flair_id` (partial index); no new RLS (existing mod/author update policies) |
| `20260812000010_community_branding.sql` | `spaces.icon_url`/`banner_url`; `community-assets` public storage bucket (mod-gated writes, uuid-folder guard) |
| `20260812000011_nested_replies.sql` | `posts.parent_id` (self-ref, cascade) + thread/parent index; `notify_new_post` also pings the parent comment author |
| `20260812000012_saved_items.sql` | `saved_collections` + `saved_items` (user-owned RLS; polymorphic item_type thread/material; FK set-null on folder delete) |
| `20260812000013_weekly_digests.sql` | `send_weekly_digests()` RPC (per-user weekly activity counts + dedupe) for the `/api/cron/digest` cron |
| `20260812000014_mod_dashboard_automod.sql` | `spaces.automod_rules` jsonb; `moderation_actions.space_id` + index; space-mod log read policy; `auto_flag` self-log insert policy |
| `20260812000015_chat_moderation_queue.sql` | `chat_moderation_queue` (pending/processing/processed/failed, attempts) + `claim_chat_moderation_batch()` RPC; `study_room_messages.hidden`; insert policy (user enqueues own) |
| `20260812000016_message_reports.sql` | `report_target_type` gains `message`; app moderators can read room chat (incl. space rooms) for the mod queue |
| `20260812000017_database_housekeeping.sql` | `get_table_sizes()` (per-table size/rows); `run_housekeeping()` retention pruning (queue 7d, read notifications 30d, sent reminders 30d) |
| `combined.sql` | All of the above concatenated (one-shot fresh install) |

> **Existing projects:** newer migrations (0001–0005, study_progress,
> profanity_escalation, multi_tenant_schools) are standalone and must be applied
> manually — they are **not** idempotent, so don't re-run `initial_schema.sql`.

## Verification

Run `supabase/verify_schema.sql` in the SQL editor — every expected table must
report `exists = true`. If any is `false`, apply the matching migration only.
