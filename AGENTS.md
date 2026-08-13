<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Development Log

Append a dated entry after every meaningful change. Keep each entry short (what changed, files touched, anything broken/blocked). Newest at top.

## 2026-08-13 — Drop unused dependencies
- Removed `pg` and `@hookform/resolvers` from `package.json` (never imported anywhere) via `npm uninstall`, refreshing `package-lock.json` (−159 lines, 15 transitive packages). tsc + 186 tests still green.

## 2026-08-13 — Consolidate pending_apply.sql
- Folded migrations **0016** (message reports), **0017** (DB housekeeping), and the **20260813 batch 0001-0007** (parent digests, room moderation, ask-community, study parties, accountability groups, quiz integrity, party RSVPs) into `supabase/migrations/pending_apply.sql`, so a single paste enables every pending feature. Header now reads "0008-0017 + 0000-0007".
- Section order respects dependencies (0015 stays first; 0006 quiz-integrity after 0008 quiz-posts; 0007 party-rsvps after 0004 study-parties). Each appended section was verified **byte-identical** to its source `.sql` file via a diff loop.
- Note: 0001 (parent digests) and 0005 (accountability groups) still use bare `create policy` (not `drop if exists`), so the file is "run once" — consistent with the existing sections.

## 2026-08-13 — Unanswered-questions filter (URL state)
- Added an **Unanswered** chip to `ThreadFeed` next to the sort tabs (with a live count) that filters the feed to questions with no accepted answer (`kind === "question" && !accepted_answer_id`). Composes with the flair filter and all four sorts; empty state says everyone's getting helped.
- The **whole feed view is URL-driven** now (`?sort=top&flair=<id>&filter=unanswered`): `sort` is parsed/coerced via a `parseSort` helper (invalid → `hot`), `flairId` and `showUnanswered` are derived from `useSearchParams`, and a shared `updateParam(key, value)` helper does `router.replace(..., { scroll: false })`. Defaults (`sort=hot`, no flair, no filter) stay out of the URL, so links are clean. Survives refresh + back/forward and is shareable.
- **Server-side filter:** `spaces/[slug]/page.tsx` now reads the `searchParams` promise and, when `?filter=unanswered`, applies `.eq("kind", "question").is("accepted_answer_id", null)` to the Supabase query — so deep links fetch up to 30 unanswered questions directly instead of trimming a mixed 30-row batch on the client. Other `filter` values are ignored (client treats anything ≠ `unanswered` as off).
- Quality: tsc clean, lint clean, **186/186 tests**, build compiles (page is dynamic via cookie auth, so `useSearchParams` needs no Suspense boundary). Docs: FEATURES.

## 2026-08-13 — Sort accepted answers to the top
- Extracted the reply-tree build into `src/lib/post-tree.ts` (`buildPostTree<T>(posts, acceptedId)`) — roots + per-parent children sorted by date, and the accepted answer **hoisted to the front** of the root list (its own replies follow it), whether it was top-level or nested. +5 unit tests.
- `thread-posts.tsx` now uses the helper (`useMemo(() => buildPostTree(posts, acceptedId), [posts, acceptedId])`) instead of inline tree building.
- Quality: tsc clean, lint clean, **186/186 tests** (was 181), build compiles. Docs: FEATURES.

## 2026-08-13 — Study party auto-end when empty
- **Pure helper** `isLastPresentUser(state, myUserId)` in `study-room-utils.ts` (+3 tests): true when the raw Realtime presence state has no other users and ≤1 of my own connections (multi-tab aware).
- **Action** `autoEndPartyWhenEmpty(roomId)` in `src/actions/study-rooms.ts` (uses `createAdminClient` to bypass the host-only update RLS): ends the room only when it's an active party whose `starts_at` has passed, and the caller actually participated (creator, RSVP, or a `study_sessions` row). Idempotent; revalidates hub + room.
- **`room-presence.tsx`**: new `autoEndParty` prop — on unmount, if `isLastPresentUser` says closing my last tab empties the room, it fire-and-forgets the auto-end action. `study-room.tsx` passes `autoEndParty={Boolean(room.starts_at)}`; `StudyRoomData` gains `starts_at` (threaded from the room page).
- **Known gap:** a hard crash of the *last* remaining person has no client to fire the trigger (clean navigation/Leave is covered) — the host can still end manually.
- Quality: tsc clean, lint clean, **181/181 tests** (was 178), build compiles. Docs: ROADMAP, FEATURES.

## 2026-08-13 — Study party RSVP + reminders
- **Migration** `20260813000007_party_rsvps.sql` (manual apply ⚠️, idempotent): `study_room_rsvps` (PK room+user, `reminded_at` dedupe, index on room). RLS: anyone can view; insert gated to self + active room with a future `starts_at`; delete own.
- **Pure helpers** in `study-room-utils.ts` (+2 tests): `partyReminderDue` (starts within the 15-min lead window), `shouldRsvpRemindNow` (RSVP to a party within 30 min reminds instantly).
- **`src/lib/party-reminders.ts`**: `sendPartyReminders()` — admin sweep for parties starting within the lead window; pings each un-reminded RSVPer via `create_notification` (type `party_reminder`, link → room) and marks `reminded_at`. Best-effort, never throws.
- **Actions** `src/actions/party-rsvps.ts`: `rsvpToParty` (validates future party, upsert, instant reminder when close, returns attendee count), `unrsvpParty`.
- **UI**: `PartyRsvp` client component (count + Going/RSVP toggle) on the hub's upcoming cards (cards restructured so the button isn't nested in the card link) and a room-page party banner (countdown + RSVP). Lazy sweep on hub + room page loads; also wired into `/api/cron/digest` and `/api/push/send`.
- Quality: tsc clean, lint clean, **178/178 tests** (was 176), build compiles. Degrades gracefully pre-migration (RSVP UI empty, sweep no-ops). Docs: ROADMAP, FEATURES.

## 2026-08-13 — Quiz cheating guard (answer-time fingerprints)
- **Pure lib** `src/lib/quiz-integrity.ts` (+8 tests): `analyzeQuizIntegrity` — flags when a perfect score is answered implausibly fast (`totalMs < max(10s, n×1.5s)`), has a fast median (`<1500ms`), or >50% of questions are answered in `<800ms`. Missing timing on a perfect score is itself suspicious. Advisory verdict — never trusted from the client.
- **Migration** `20260813000006_quiz_integrity.sql` (manual apply ⚠️, idempotent): `quiz_attempts` gains `total_ms int`, `answer_times_ms jsonb`, `flagged boolean`, `flag_reasons text[]`.
- **`submitQuizResult(materialId, answers, timing?)`** now computes the verdict server-side; a flagged attempt preserves the existing best score, skips XP, and returns `flagged`/`flagReasons`. Pre-migration the extended upsert falls back to the legacy shape (guard inactive).
- **`quiz-player.tsx`**: tracks quiz start + per-question first-shown/first-answered (refs), sends `{ totalMs, answerTimesMs }`, and shows an amber "too fast to be fairly graded — won't count toward the leaderboard" banner on flagged results.
- Quality: tsc clean, lint clean, **176/176 tests** (was 168), build compiles. Docs: ROADMAP.

## 2026-08-13 — Community RAG tutor (librarian AI)
- **Pure lib** `src/lib/community-rag.ts` (no migration, +12 unit tests): `buildCorpus` (notes/flashcards/quizzes/links/files/threads/posts → `RagChunk[]` with route hrefs), `tokenize`/`rankChunks` (lexical retrieval — query-term overlap + 3x title boost, top-k), `buildTutorPrompt` (numbered-context system/user prompt asking for `{ answer, citations }` JSON), `parseTutorResponse` (tolerant of prose wrappers, clamps citation indices). 4000-char per-chunk cap.
- **Action** `src/actions/community-tutor.ts`: `askCommunityTutor(spaceSlug, question)` — membership gate (or public space), fast local profanity check, 500-char cap, fetches the space's corpus (materials/threads/posts, hidden excluded), ranks top 6, calls Groq `llama-3.1-8b-instant`, returns `{ answer, citations:[{title,href,kind}] }`. Graceful when `GROQ_API_KEY` is missing or the corpus is empty.
- **UI** `src/components/community/community-tutor.tsx`: "Community librarian" card in the space-page sidebar (question input, loading spinner, whitespace-preserved answer, citation badge chips linking to materials/threads).
- **Gap:** PDFs/files are indexed by title/description only — full-text extraction needs a PDF parser (or embeddings + pgvector) as a follow-up.
- Quality: tsc clean, lint clean, **168/168 tests** (was 156), build compiles. No migration. Docs: ROADMAP, FEATURES.

## 2026-08-13 — Offline-first rooms (chat queue + whiteboard snapshot replay)
- **Pure lib** `src/lib/offline-room-sync.ts` (no migration): one localStorage key (`lf-offline-room-sync`) holding a per-room **chat queue** (capped at 50, oldest evicted) + the latest **pending whiteboard snapshot**, with a shared `lf-offline-room-sync-updated` event. Functions: `queueChatMessage`, `pendingChatMessages`/`pendingChatCount`, `removeChatMessage`, `clearChatQueue`, `savePendingWhiteboard`, `loadPendingWhiteboard`, `clearPendingWhiteboard`, `roomsWithPendingSync`. Last-writer-wins (matches the snapshot model), not a CRDT merge. +11 unit tests.
- **`room-chat.tsx`**: `handleSend` queues locally when `navigator.onLine` is false (optimistic "queued" bubble + `queued` count in the header) and on a thrown server-action network failure; moderation/mute rejections still surface inline. `flushQueue` replays the queue **in order** on the `online` event (and on mount), stopping at the first failure. A delivered realtime message confirms its queued copy by body (dedupes the bubble).
- **`whiteboard.tsx`**: `scheduleSave` writes the latest strokes to `savePendingWhiteboard` when offline or the save fails; a `flushPendingBoard` effect replays the snapshot on `online` and clears it on success; a **"Saved locally"** amber badge shows while a snapshot is waiting.
- Quality: tsc clean, lint clean, **156/156 tests** (was 145), build compiles. No migration needed. Docs: ROADMAP (§5 + §8), FEATURES.

## 2026-08-13 — Accountability groups
- **Migration** `20260813000005_accountability_groups.sql` (manual apply ⚠️): `accountability_groups` (name + weekly_goal), `accountability_group_members` (PK group+user), `accountability_checkins` (PK group+user+date, UTC date), `accountability_nudges` (peer nudges). All RLS-browsable at app scale; insert gated to the acting user; creator (or app mod) deletes the group.
- **Pure helpers** `src/lib/accountability.ts` (UTC date math to match the app's check-in convention): `weekStart`, `utcDateKey`, `checkedInSince`, `groupStreak` (consecutive all-member days; today in-progress), `weeklyProgress` (0–1). +8 unit tests.
- **Actions** `src/actions/accountability.ts`: `createAccountabilityGroup` (creator auto-joins), `joinAccountabilityGroup` (max 8), `leaveAccountabilityGroup`, `checkInGroup` (idempotent per day), `nudgeMember` (24h cooldown + `create_notification` type `nudge` → `/app/groups`).
- **UI**: `/app/groups` page + `AccountabilityGroups` client component — create form, per-group progress bar (% checked in this week), 🎯 weekly goal, 🔥 group streak badge, member list with green check-ins + Nudge buttons, join/leave/check-in. Nav links added (desktop + mobile).
- Quality: tsc clean, lint clean, 145/145 tests, build compiles. Degrades gracefully pre-migration (empty list). Docs: ROADMAP.

## 2026-08-13 — Study parties (scheduled rooms + minutes leaderboard)
- **Migration** `20260813000004_study_parties.sql` (manual apply ⚠️): `study_rooms.starts_at` (nullable — set = scheduled party), `study_sessions` table (room+user+minutes+`focus_key`, unique (room,user,focus_key) so a broadcast focus completion dedupes to one row per participant), `get_study_party_leaderboard(days, limit)` security-definer RPC (total participant-minutes + distinct participants, last N days).
- **`src/actions/study-rooms.ts`**: `createStudyRoom` accepts an optional future `startsAt` (rejects past/invalid); new `recordStudySession(roomId, focusKey)` upserts a focus block (minutes = 25).
- **`pomodoro-timer.tsx`**: on focus→break auto-transition, fires `recordStudySession(roomId, `${roomId}:${endsAt}`)` (fire-and-forget; the shared `endsAt` is the dedupe key across clients).
- **Hub** `/app/study-rooms`: splits **Upcoming study parties** (live `PartyCountdown` badge → "Live" once passed) from **Open rooms**; new **Most minutes studied together this week** leaderboard (🥇🥈🥉 + participant count). `StudyRoomForm` gains a `datetime-local` start time.
- Quality: tsc clean, lint clean, 137/137 tests, build compiles. Degrades gracefully pre-migration (no `starts_at` ⇒ all live; leaderboard empty). Docs: ROADMAP.

## 2026-08-13 — "Ask the community" question posts + official answers
- **Migration** `20260813000003_ask_community.sql` (manual apply ⚠️): `threads.kind` (`discussion` | `question`, default discussion), `threads.what_tried`, `threads.accepted_answer_id uuid → posts (on delete set null)`, index on `(kind, created_at)`.
- **`src/actions/discussion.ts`**: `createThread` reads `kind` + `what_tried` (question ⇒ `what_tried` required via `whatTriedSchema`; included in AI/automod text). New `markOfficialAnswer(threadId, postId|null)` — author, space mod, or app mod; post must belong to the thread; updates `accepted_answer_id`.
- **UI**: `NewThreadForm` (`src/components/community/new-thread-form.tsx`) replaces the inline new-thread form on the space page — a Discussion / "Ask the community" toggle with a required "What have you tried?" textarea for questions. `ThreadPosts` renders a green "Official answer" badge on the accepted reply + a Mark-as-answer button (author/mods); `ThreadPage` shows the "What I've tried" block and Question/Answered badges; `ThreadFeed` shows Question/Answered badges.
- Quality: tsc clean, lint clean, 136/136 tests, build compiles. Degrades gracefully pre-migration (`kind` null ⇒ treated as discussion). Docs: ROADMAP.

## 2026-08-13 — Per-user whiteboard colors
- **Whiteboard strokes now carry `author_id`/`author_name`** (`WhiteboardStroke` type). A new **"Person" toolbar toggle** (default on) renders each author's strokes in their deterministic palette color via `strokeRenderColor(stroke, byPerson)` in `study-room-utils.ts` — the same color their live presence cursor already uses — so you can tell who drew what. A "who drew what" legend lists distinct authors with color chips under the toolbar; the manual color swatches dim/disable in person mode. Exported PNGs honor the toggle too.
- Files: `src/components/study-rooms/whiteboard.tsx`, `src/lib/study-room-utils.ts`, `src/lib/__tests__/study-room-utils.test.ts` (+1 test → 136/136). Backwards-compatible: legacy strokes without `author_id` fall back to their own color.
- Quality: tsc clean, lint clean, 136/136 tests, build compiles. No migration needed (strokes stay in the existing `whiteboard` jsonb).

## 2026-08-13 — Room chat rate limits + host kick/mute
- **Migration** `20260813000002_room_moderation.sql` (manual apply ⚠️): `study_room_moderation` table (unique room+user, `action` mute/ban, `expires_at` null=permanent); RLS — participants can read, hosts manage; drops/recreates the chat insert policy as "Users post in visible rooms (unmuted)" so muted/banned users can't bypass via direct writes.
- **`src/actions/study-rooms.ts`**: `moderateRoomMember(roomId, targetUserId, action)` (host gate: creator / app mod / space mod; can't self-moderate or moderate another host; mute = 10 min, ban = permanent until unban). `sendRoomMessage` now checks mute/ban and enforces a DB-counted rate limit (6 msgs / 15s per user); `saveWhiteboard` blocks banned users. Helpers `getRoomRestriction` / `isRoomHost`.
- **`RoomModeration`** (`src/components/study-rooms/room-moderation.tsx`): host-only "Moderate" dropdown listing live presence participants with mute/unmute + ban/unban buttons (per-action spinners, 30s clock tick to auto-clear expired mutes). `RoomChat` disables the composer with a "muted"/"removed" placeholder; `StudyRoom` + room page thread `isHost`/`moderationRows`/`myMuted`/`myBanned` through.
- Quality: tsc clean, lint clean, 135/135 tests, build compiles. Docs: ROADMAP.

## 2026-08-13 — Parent progress digest
- **Migration** `20260813000001_parent_digests.sql` (manual apply ⚠️): `parent_digests` table (one row per student per month — XP, level, streaks, 30-day thread/material/reply counts, XP delta vs prior digest, `status` pending/sent/failed, email-ready `body`) + `send_parent_digests()` RPC (security definer; skips users without `parent_email` or already digested this month; pings the student via a `parent_digest` notification).
- **Settings** (`src/app/app/settings/page.tsx`, `src/actions/profile.ts`): `parent_email` is now editable in the profile form (validated with `emailSchema`, empty clears it) — previously only settable via the restricted-account banner. A "Parent progress report" card shows the latest digest (guarded so the page renders before the migration lands).
- **Cron** `/api/cron/digest` now also calls `send_parent_digests()` on the Monday run (self-gates to monthly; non-fatal on failure). No new cron slot needed.
- **Known gap**: email sending isn't wired — rows are queued with `status='pending'` (same pattern as `profanity_notifications`). Needs an email provider (Resend/SendGrid) + a flush route. "Minutes studied" isn't tracked either — the digest reports XP/level/streaks/contributions instead.
- Quality: tsc clean, lint clean, 135/135 tests, build compiles. Docs: ROADMAP.

## 2026-08-13 — Whiteboard export & pin to community
- **Whiteboard** (`src/components/study-rooms/whiteboard.tsx`): new toolbar buttons — **Download PNG** (client renders strokes to a 2x offscreen canvas, eraser strokes drawn as opaque white so the PNG has a solid background) and **Pin to community** (only for space-linked rooms; shows a spinner while uploading, sonner toast on success/failure).
- **Action** `pinWhiteboardToSpace(roomId, spaceSlug, dataUrl, title)` in `src/actions/study-rooms.ts`: validates the room belongs to the space + membership, parses the PNG data URL, downscales via sharp ≤1920px, stores in the `materials` bucket + `storage_objects`, and creates a `file` material with `metadata.mime: "image/png"` (so the feed shows the image thumbnail/lightbox). Title defaults to `<room> — whiteboard`; description records the source room.
- **`StudyRoom`** passes `spaceSlug`/`roomName` down to the Whiteboard.
- Quality: tsc clean, lint clean, 135/135 tests, build compiles. No new migration (reuses `study_materials` + `materials` bucket). Docs: FEATURES, ROADMAP.

## 2026-08-13 — User profiles + broad file-type uploads
- **Migration** `20260813000000_user_profiles_upload_types.sql` (manual apply ⚠️ — appended to `pending_apply.sql`): restores `profiles.major/bio/interests/parent_email/principal_email/gpa/current_class_id/credits_completed` (schema-drift fix); `get_public_stats(uuid)` security-definer RPC exposing just XP/level/streaks from private `user_stats`; `storage.buckets` `materials` now allows doc/xlsx/pptx/rtf/txt/md/csv/html/json/xml/zip/7z/rar/tar/gz/audio/video + 15 MB cap.
- **Profiles**: `/app/settings` gains avatar upload/remove (`AvatarUpload`, sharp 256px → `avatars/{userId}/avatar`, 2 MB cap), major, interests (comma-list → text[]), bio (500 chars). Profile page shows avatar, role badge, major, GPA, bio, interest tags, XP/level/streak stats (via RPC), and an Edit link when viewing yourself. Profile links now point at `/app/profile/[id]` from the dashboard leaderboard, material list, and thread posts.
- **Files**: `src/lib/file-types.ts` (MIME allowlist, categories, icons, `FILE_ACCEPT_ATTR`, `fileExtension`, `formatFileSize`); `uploadFileMaterial` skips sharp compression for GIFs; `material-list` links author → profile.
- Quality: `tsc` clean, lint clean, 135/135 tests. `.env.vercel.prod` (with the working POSTGRES_URL used by `scripts/run-sql.cjs`) was **removed mid-session** — direct DB apply not possible; use the SQL editor one-paste.

## 2026-08-12 — Database management (free-tier 500 MB cap)
- **Migration** `20260812000017_database_housekeeping.sql` (manual apply ⚠️): `get_table_sizes()` (per-table size + row count) and `run_housekeeping(p_queue_days=7, p_notification_days=30, p_reminder_days=30)` retention pruning (consumed queue rows, read notifications, sent meeting reminders).
- **`src/lib/archive.ts`**: per-table retention days — moderation_actions/audit_log/reports 30d, **`study_room_messages` 90d** (chat history was the biggest unmanaged growth source) — archived to the archive project before deletion; `getDbUsageReport()` exported for the dashboard.
- **Daily maintenance** on the existing push cron (cron slots are full): drain chat moderation → `checkAndArchive()` → `run_housekeeping`. Archival no-ops safely when `ARCHIVE_SUPABASE_*` isn't configured.
- **Admin dashboard** `/app/admin`: new "Database health" card — usage bar vs 500 MB, archive status (red warning when >80% with no archive), retention summary, top-8 largest tables. Also fixed the old "Total Storage" stat which displayed a row count as MB.
- Quality: 135/135 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (27 migrations). Docs: DATABASE, FEATURES, LAUNCH_CHECKLIST.

## 2026-08-12 — Room chat moderation backfill
- **`supabase/backfill_chat_moderation.sql`** (one-off paste, idempotent): enqueues every `study_room_messages` row not already in `chat_moderation_queue` (NOT EXISTS dedupe, skips hidden) so old history gets AI-reviewed by the existing batched pipeline.
- **Drain route** `/api/moderation/chat` accepts `?chunks=N` (1–50, default 3) to chew through a big backlog fast (N × 15 messages per call) after the backfill.
- Quality: 135/135 tests, tsc + lint clean, build compiles. Docs: MODERATION.

## 2026-08-12 — Per-message report button in room chat
- **Migration** `20260812000016_message_reports.sql` (manual apply ⚠️): `report_target_type` gains `message` (`ADD VALUE IF NOT EXISTS`); app moderators can now read room chat (incl. space-linked rooms) so the mod queue can show the reported message.
- **UI** `room-chat.tsx`: hover any message (own or others, even ended rooms) → compact 🚩 report button in the hover row opens the standard report dialog (`ReportButton` gained a `compact` icon-only variant); hidden messages show no report button.
- **Actions** `submitReport`/`submitReportFromForm` accept `message` targets; `moderateContent` handles messages (hide/approve/reject map to `study_room_messages.hidden`).
- **Mod queue** `/app/mod`: message reports render the reported message body (fetched via the new app-mod read policy).
- Quality: 135/135 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (26 migrations). Docs: MODERATION, DATABASE, FEATURES, LAUNCH_CHECKLIST.

## 2026-08-12 — Batched AI moderation for room chat
- **Migration** `20260812000015_chat_moderation_queue.sql` (manual apply ⚠️): `chat_moderation_queue` (status pending/processing/processed/failed, attempts, message FK cascade) + `claim_chat_moderation_batch(p_limit)` RPC (atomic UPDATE…RETURNING claim — concurrent flushes never double-process) + `study_room_messages.hidden` (client shows a removal placeholder) + insert policy (user enqueues own).
- **Send path** (`sendRoomMessage`): now uses `checkRoomMessageFast` (local profanity + spam + escalation only — **no Groq round-trip per message**), inserts, then best-effort enqueues for AI review and kicks `/api/moderation/chat` fire-and-forget via `after()` (Next 16) so sending stays instant. If the queue table is missing the message still sends.
- **Lib** `src/lib/chat-moderation.ts`: `moderateChatBatch` sends up to 15 messages to Groq in **one batched request**; `parseChatBatchResponse` maps `{index → verdict}` safely (7 new unit tests → 135 total); `isFlagged` = unclean + medium/high; `applyChatModerationResults` marks processed, hides flagged messages, logs `moderation_actions` rows (space-scoped), and escalates via `handle_profanity_escalation`; retries up to 5 attempts then `failed`.
- **Route** `/api/moderation/chat` (CRON_SECRET-guarded, GET+POST): drains the queue in up to 3 chunks. **Not a vercel.json cron** (Hobby's 2-cron limit is full) — the daily push cron drains 1 chunk as a safety net so a dead-quiet room still gets reviewed.
- Quality: 135/135 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (25 migrations). Docs: MODERATION (coverage table + study-room section), DATABASE, FEATURES, ROADMAP.

## 2026-08-12 — Community leaderboard
- **Route** `/app/spaces/[slug]/leaderboard` (header link, visible to readers): ranks members by XP (level = floor(xp/100)+1, streak from `user_stats`) or contributions (threads + materials + replies in that community, counted via per-author group queries).
- **UI** `community-leaderboard.tsx`: XP/Contributions sort chips, 🥇🥈🥉 medals, Mod badge, (you) highlight, streak flame.
- Quality: 128/128 tests, tsc + lint clean, build compiles. No migration.

## 2026-08-12 — AI monitoring hardening (all creation surfaces)
- `checkContentWithAI` prompt now also flags **promotional/advertising content** and mandates educational/on-topic content.
- Wired AI checks into previously unmonitored actions: `createLinkMaterial`, `createNoteMaterial`, `createFlashcardMaterial`, `uploadFileMaterial` (title only), `createQuizMaterial` (questions/options), `postAnnouncement`, `createMeeting` — high risk → rejected (materials redirect with an `?error=` banner on the materials page; quiz/announcement/meeting return errors).
- Room chat keeps the fast local pipeline on the send path and AI-reviews messages **in batches** (`/api/moderation/chat`, migration 0015); docs/MODERATION.md now has a coverage table.
- Quality: 128/128 tests, tsc + lint clean, build compiles.

## 2026-08-12 — Mod dashboard + automod
- **Migration** `20260812000014_mod_dashboard_automod.sql` (manual apply ⚠️): `spaces.automod_rules` jsonb; `moderation_actions.space_id` + index; space-mod log select policy; insert policy now allows `action='auto_flag'` self-logging (fixes silently-dropped AI/automod flags).
- **Lib** `src/lib/automod.ts`: `AutomodRule` (name, comma keywords, scope thread/post/all, action flag/remove), `validateAutomodRules`, `checkAutomod` — 7 new unit tests (128 total).
- **Enforcement** in `createThread`/`createPost`: remove → reject with rule name; flag → `is_hidden` + `moderation_actions` row (space_id, note). **Bug fix:** `createThread` resolved the bound slug as `space_id` (uuid FK) — thread creation from the community page was broken; now resolves id via `id.eq OR slug.eq`.
- **Page** `/app/spaces/[slug]/moderation`: `AutomodEditor` (add/edit/remove rules, scope + action selects) + mod action history; linked from the space header for mods.
- Quality: 128/128 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (24 migrations).

## 2026-08-12 — Weekly community digest
- **Migration** `20260812000013_weekly_digests.sql` (manual apply ⚠️): `send_weekly_digests()` RPC — per member-user, counts new threads/materials/replies in their communities over 7 days, dedupes to one `digest` notification per rolling week, skips no-activity weeks.
- **Cron** `/api/cron/digest` (CRON_SECRET-guarded, mirrors `/api/push/send`); `vercel.json` adds `0 8 * * 1` (Monday 08:00 UTC) — Hobby plan has 2 cron slots.
- Bell + notifications page render `digest` with 📬; digests link to `/app/feed` and flow through push.
- Quality: 121/121 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (23 migrations).

## 2026-08-12 — Save / bookmark collections
- **Migration** `20260812000012_saved_items.sql` (manual apply ⚠️): `saved_collections` (user-owned) + `saved_items` (PK user+type+item, polymorphic item_type thread/material, folder FK set-null), all RLS `auth.uid() = user_id`.
- **Actions** (`src/actions/saved.ts`): `toggleSaveItem` (RLS-verified target, unsave via delete), `createSavedCollection` (form action), `deleteSavedCollection`, `moveSavedItem` (validates the folder is the caller's).
- **UI**: `/app/saved` groups items into named folders + Uncategorized with per-item move/unsave; `SaveButton` bookmark toggle on thread pages and material cards (compact icon); graceful setup notice until the migration lands (page checks query errors, buttons toast).
- Quality: 121/121 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (22 migrations).

## 2026-08-12 — Community home feed (Reddit Phase 4)
- **Route** `/app/feed` (nav, desktop + mobile): server page fetches recent threads + study_materials from my communities (memberships ∪ public spaces), RLS-scoped, 50 each, newest first.
- **`CommunityFeed`** client component merges both into one chronological timeline (capped 60) with All/Discussions/Materials filter chips; thread cards show score; material cards use type icons and link to the detail page for flashcard_set/quiz/file, else the materials list.
- Quality: 121/121 tests, tsc + lint clean, build compiles. No migration. Vercel cap still active.

## 2026-08-12 — Nested (threaded) replies
- **Migration** `20260812000011_nested_replies.sql` (manual apply ⚠️): `posts.parent_id` (self-ref, cascade) + `(thread_id, parent_id)` index; `notify_new_post` trigger extended to also ping the parent comment author (skips self + thread author).
- **Action**: `createPost` reads an optional `parent_id` from the form and validates it belongs to the same thread before inserting.
- **UI**: `ThreadPosts` rewritten as a recursive comment tree — per-post Reply button + inline composer (hidden `parent_id` input, honeypot kept), indentation capped at 3 levels (unlimited data depth), posts arriving over realtime nest correctly.
- Quality: 121/121 tests, tsc + lint clean, build compiles. `combined.sql` regenerated (21 migrations).

## 2026-08-12 — Quiz results → SM-2 review queue
- `createQuizReviewDeck(quizId, missedIndices)` in `src/actions/quizzes.ts`: server builds flashcard_set cards (front = question, back = correct answer + 💡 explanation) from the quiz payload, validates indices, idempotent via `metadata.is_quiz_review` + `metadata.quiz_id` lookup; `getQuizReviewDeck` finds the existing deck across reloads. No migration.
- `QuizPlayer` results screen: "Add to my review queue" button (hidden on perfect scores) → "Review deck" link to the new deck; deck flows through the existing SM-2 flashcard review + local progress tracking.
- Quality: 121/121 tests, tsc + lint clean, build compiles. Cap cleared — deployed + aliased successfully.

## 2026-08-12 — PDF posts + image lightbox (Reddit Phase 3b)
- **Preview route** `/app/spaces/[slug]/materials/[id]/preview/route.ts`: streams private-bucket bytes (signed URL fetched server-side) with `Content-Disposition: inline` — lets iframes/img render materials without a public bucket; gated by RLS on study_materials.
- **Detail page** now handles `file` materials: PDFs get a 75vh inline preview pane + Download/Open-in-new-tab; images get a click-to-zoom large view + download.
- **`ImageLightbox`** client component (fullscreen overlay, Escape/backdrop/X close, body scroll lock); materials list shows image thumbnails that open it and a Preview button for PDFs.
- Quality: 121/121 tests, tsc + lint clean (0 warnings), build compiles. No migration. Vercel cap still active — 11 verified commits queued.

## 2026-08-12 — Browse-by-flair on the community feed
- `ThreadFeed` gains a color-coded flair chip row (All + each flair, toggle to clear) that filters the thread list before Hot/New/Top/Controversial ranking; empty state distinguishes "no threads" from "none with this flair". Client-only, no migration.
- Quality: 121/121 tests, tsc + lint clean, build compiles. Vercel cap still active — 10 verified commits queued.

## 2026-08-12 — Community branding + directory (Reddit Phase 2b round 2)
- **Migration** `20260812000010_community_branding.sql` (manual apply ⚠️): `spaces.icon_url`/`banner_url`; `community-assets` storage bucket (public 5MB, image mimes) with public-read + mod-write policies (path folder must be a valid space uuid, guards the cast).
- **Actions** (`src/actions/community.ts`): `uploadCommunityAsset(spaceId, kind, formData)` — mod-gated, sharp-compresses icon 256×256 / banner 1600×400 → jpeg, upserts to `community-assets/{spaceId}/{kind}.jpg`, tracks `storage_objects`, stores public URL on the space; `removeCommunityAsset`.
- **UI**: `BrandingUpload` client component (upload/replace/remove + preview); space page shows banner header + icon (initial fallback); new `/app/communities` directory (server page + `CommunityDirectory` client grid with live search); nav links (desktop + mobile) + Spaces page browse button.
- **Quality**: 121/121 tests, tsc + lint clean (0 warnings), `next build` compiles. `combined.sql` regenerated (20 migrations).
- **Blocked**: Vercel 100-deploys/day cap — 9 verified commits queued.

## 2026-08-12 — Post flairs (Reddit Phase 2b)
- **Migration** `20260812000009_post_flairs.sql` (manual apply ⚠️): `spaces.flairs` jsonb (default `[]`) + `threads.flair_id` text + partial index. No new RLS — spaces updates are mod-gated (0006), threads updates already allow author + space/app mods.
- **Lib**: `src/lib/community.ts` — `FLAIR_COLORS` (8 fixed Tailwind-safe colors), `FLAIR_COLOR_CLASSES`/`FLAIR_SWATCH_CLASSES`, `validateFlairs` (≤15 flairs, ≤40-char labels, unique ids, generated ids); 6 new unit tests (`community.test.ts`).
- **Actions**: `saveCommunityFlairs` in `src/actions/community.ts` (mod-gated); `createThread` reads an optional `flair` field validated against the space's flairs (space rows resolved by id OR slug via `.or()`), `setThreadFlair(threadId, flairId|null)` gated to author/mods.
- **UI**: `CommunityAdmin` gains a flairs editor (label input + 8-color swatch picker per flair); New-thread form gets a flair `<select>`; `ThreadFeed` renders colored chips on cards; new `ThreadFlairControl` on the thread page (badge for everyone, change select for author/mods).
- **Quality**: 121/121 tests, tsc + lint clean, `next build` compiles. `combined.sql` regenerated (19 migrations).
- **Blocked**: Vercel 100-deploys/day cap still active — 8 verified commits queued (mentions/reactions → cursors → docs → community → voting → quizzes → flairs).

## 2026-08-12 — Quiz posts + community leaderboard (Reddit Phase 3a)
- **Migration** `20260812000008_quiz_posts.sql` (manual apply ⚠️): `material_type` gains `quiz`; `quiz_attempts` table (PK material+user, best_score_pct/correct/total/attempts, RLS via `can_read_space` + hidden-material guard, leaderboard index).
- **Lib**: `src/lib/quizzes.ts` — payload validation (≤20 Q, 2–6 options, byte cap) + authoritative `gradeQuiz`; 8 new unit tests.
- **Actions**: `src/actions/quizzes.ts` — `createQuizMaterial` (members only, +15 XP), `submitQuizResult` (grades server-side, upserts best attempt, +5 XP on personal best), `getQuizLeaderboard` (top 10 + caller's best).
- **UI**: `QuizBuilder` (inline composer on materials page), `QuizPlayer` (intro → one-at-a-time → instant grade + per-question review with explanations), `QuizLeaderboard` (🥇🥈🥉 top 10). Materials list gains a quiz icon, `Take quiz` button, and the existing Quizzes filter chip now matches the real `quiz` type.
- **Quality**: 115/115 tests, tsc + lint clean, `next build` compiles. `combined.sql` regenerated (18 migrations).
- **Blocked**: Vercel 100-deploys/day cap still active — 6 verified commits queued (mentions/reactions → cursors → docs → community → voting → quizzes).

## 2026-08-12 — Thread voting + feed sorting (Reddit Phase 2a)
- **Votes**: `post_votes` table (PK post+user, vote 1/-1) + `threads.score/ups/downs` cached columns, maintained by the `update_thread_score` trigger (recompute on insert/update/delete — idempotent, race-safe) — migration `20260812000007_thread_votes.sql` (manual apply ⚠️). RLS mirrors thread readability (`can_read_space`), votes owned per user.
- **Action**: `voteOnThread(threadId, vote)` in `src/actions/discussion.ts` (upsert/delete + revalidate space + thread pages).
- **Feed**: `src/components/community/thread-feed.tsx` — Reddit-style vote cluster (▲ score ▼) with highlighted active vote + **Hot / New / Top / Controversial** sort tabs; `src/lib/thread-ranking.ts` pure ranking (hot = score/(hours+2)^1.5, controversial = min(ups,downs)·(1+total/1000), pinned always on top) — 9 new unit tests → 107/107.
- **Page**: space page now fetches the user's votes and renders ThreadFeed (thread cards moved out of the server component).
- Verified: `tsc` clean, lint clean, 107/107 tests, `next build` compiles.

## 2026-08-12 — Community layer (Reddit-for-learners Phase 1)
- **Community rules + announcements**: `spaces.rules` and `spaces.announcements` jsonb columns (migration `20260812000006_community_rules.sql`, manual apply) + new "App moderators can update spaces" RLS policy. New `src/actions/community.ts` (saveCommunityRules / postAnnouncement / deleteAnnouncement, gated by space-or-app moderator). Space page restructured into a Reddit-style layout: 📌 announcement cards on top, main discussion column, right sidebar with About / moderators / numbered rules, and a mod-only `CommunityAdmin` panel (inline rules editor + announcement composer/delete with router.refresh).
- **Content filter chips**: materials feed now filters by All / PDFs / Images / Files / Links / Notes / Quizzes (MIME-aware — `uploadFileMaterial` now stores `metadata.mime`).
- **Blueprint**: `docs/REDDIT_FOR_LEARNERS.md` — phased brainstorm for making the app "a Reddit for learners" (voting/ranking, flairs, quiz/PDF posts, nested comments, automod, karma, home feed). Phase 1 shipped; phases 2–4 scoped.
- Verified: `tsc` clean, lint clean, 93/93 tests, `next build` compiles.

## 2026-08-12 — Full documentation
- Wrote a docs home + seven reference docs in `docs/`: `README.md` (index + repo map + route index), `ARCHITECTURE.md` (stack, runtime model, realtime primitives, data flow, free-tier guardrails), `DATABASE.md` (all 33 tables, RLS model + helpers, 26 RPCs, realtime publications, migration index), `FEATURES.md` (every feature area → routes/actions/components/behavior), `DEPLOYMENT.md` (env vars, deploy + alias, cron, native, PWA, releases, rollback), `DEVELOPMENT.md` (setup, scripts, conventions, testing), `MODERATION.md` (layered pipeline, escalation tiers, security model), `TROUBLESHOOTING.md` (common failures incl. GoTrue warnings, deploy quota, missing migrations). Root README now links `docs/README.md`.
- Facts verified against the codebase: table/RPC/realtime inventory via grep across migrations, proxy headers, workflows, electron config.

## 2026-08-12 — Whiteboard presence cursors
- **Live pointer cursors**: each user's pointer over the board shows to everyone else as a colored dot + name pill (overlay canvas, `pointer-events-none`, DPR-aware like the main canvas). Realtime **presence** on the board channel (`study-room-board-{roomId}` now has `presence.key = userId`): pointer positions tracked via `channel.track({x, y})` throttled to ~10 Hz (`CURSOR_TRACK_MS = 100`), `{x: null, y: null}` on pointer-leave to hide, auto-cleaned on disconnect (presence semantics — no ghost cursors). Per-user color: deterministic palette hash `cursorColor(userId)` in `study-room-utils.ts` (+1 test → 93/93).
- Files: `src/components/study-rooms/whiteboard.tsx` (props + presence + overlay canvas + `sizeCanvas`/`drawCursor` helpers), `src/lib/study-room-utils.ts`, `src/lib/__tests__/study-room-utils.test.ts`, `src/components/study-rooms/study-room.tsx` (passes userId/displayName).
- Verified: `tsc` clean, lint clean, 93/93 tests, `next build` compiles.

## 2026-08-12 — Room chat @mentions + emoji reactions
- **@mentions**: `@` autocomplete in the room chat composer against space members (space-linked rooms) or all profiles (open rooms); picking a name inserts `@Display Name` and adds the id to a hidden mention set. `sendRoomMessage(roomId, body, mentionIds)` now fires `create_notification` (type `mention`, 👋) per mentioned user through the existing bell — self and non-members (in space rooms) are skipped, best-effort so a failed notification never blocks the message. `renderMentions()` splits text into safe segments for highlighted `@name` rendering (no dangerouslySetInnerHTML).
- **Emoji reactions**: `study_room_message_reactions` table (PK message+user+emoji, denormalized `room_id` for realtime filtering) + RLS + realtime publication — `supabase/migrations/20260812000005_study_room_reactions.sql` (manual apply ⚠️). `toggleReaction` server action with optimistic client flips (reverted on error); live via postgres_changes INSERT/DELETE filtered per room. Curated set 👍 🎉 ❤️ 🔥 😄 🙏 (`ALLOWED_REACTIONS`), hover-smile picker per message.
- **New pure helpers** in `study-room-utils.ts` (tested): `renderMentions`, `mentionQuery`, `filterMentionCandidates`, `isAllowedReaction` (+12 tests → 98/98).
- **Wiring**: room page passes `mentionableUsers` + `initialReactions`; bell + notifications page got the `mention: 👋` icon; `combined.sql` regenerated (15 migrations), `verify_schema.sql` + README updated.
- Verified: `tsc` clean, lint clean, 98/98 tests, `next build` compiles. Deployed to Vercel (alias `learningfans.vercel.app`).

## 2026-08-12 — Interactive Study Rooms (live whiteboard, chat, focus timer)
- **Study rooms**: new feature — join live rooms at `/app/study-rooms` (hub) and `/app/study-rooms/[id]` (room). Room = shared realtime whiteboard + persisted room chat + broadcast-synced pomodoro + live presence avatars + one-click Jitsi video call + copy-invite. Entry points: desktop + mobile nav (Study Rooms), dashboard "Study together" quick actions, space pages ("Study room" → preselects the space).
- **Whiteboard** (`src/components/study-rooms/whiteboard.tsx`): canvas with DPR scaling, pen/eraser/widths/colors, undo (last stroke), clear-all (confirm). Strokes broadcast over Supabase Realtime (`study-room-board-{roomId}`); snapshot persisted to `study_rooms.whiteboard` (jsonb) with a 2 s debounce via `saveWhiteboard` action. Caps: 600 strokes / 256 KB (`src/lib/study-room-utils.ts`, unit-tested).
- **Room chat** (`room-chat.tsx`): `study_room_messages` table + `postgres_changes` realtime (same pattern as thread posts), profanity-checked server action (`sendRoomMessage` → `checkProfanityWithEscalation`), haptic on new message.
- **Pomodoro** (`pomodoro-timer.tsx`): 25/5 focus timer synced by broadcast events (start/pause/reset), `endsAt`-based countdown so everyone stays in sync, localStorage persistence per room (survives refresh), WebAudio beep + haptic on auto-transition focus→break→focus. Bug noted & fixed: resume continues from frozen remaining time.
- **Migration** `supabase/migrations/20260812000004_study_rooms.sql` (manual apply ⚠️ — no DB password): `study_rooms` + `study_room_messages` with RLS (global rooms public; space rooms space-member-only; whiteboard editable by participants; end/delete creator or mod), realtime publication for messages. Pages + actions degrade gracefully with a setup banner when the table isn't applied yet (schema-missing guards on hub, room page, and create action).
- **Streamline + communication**: dashboard "Study together" quick-action band; nav reorder; invite links; video call from room header. Brainstorm doc: `docs/ROADMAP.md`.
- Verified: `tsc` clean, lint clean, 86/86 tests (+`src/lib/__tests__/study-room-utils.test.ts`), `next build` compiles. Deployed to Vercel (alias `learningfans.vercel.app`).

## 2026-08-12 (final) — Web push pipeline + haptics everywhere
- **Web push (VAPID, no Firebase)**: `push_subscriptions` table migration (`20260812000003_push_subscriptions.sql`, manual apply) + `push_sent_at` on notifications. Routes: `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET /api/push/send` (cron target, guarded by `PUSH_CRON_SECRET`, idempotent via `push_sent_at`, prunes dead 404/410 subscriptions). `vercel.json` cron `0 8 * * *` (Hobby plan = one daily cron; tighten on Pro). Settings card `PushNotificationSetting` enables/disables via `pushManager.subscribe` with the VAPID public key. SW handles `push` + `notificationclick`. VAPID keys + `PUSH_CRON_SECRET` generated into `.env.local`; placeholders in `.env.example`. ⚠️ For production: set `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET` in Vercel env, and apply the migration, else the cron 401s/503s safely.
- **Haptics everywhere**: `hapticMedium` added; wired into live call join/end (`live-call-room`), new notification arrival (bell), both reminder notifiers, offline-deck save, plus the existing flashcard grades + check-in. All no-op on web / pre-`cap sync`.
- **Offline verification**: unit tests cover the offline-decks layer; `node --check public/sw.js` passes; port-3000 local dev server is a STALE build from Aug 11 (`changers-v1` SW — not in the repo; production serves the new sw.js). Live SW inspection isn't possible in this sandbox (servers die between tool calls; another agent's server owns :3000).
- Migrations still pending manual apply (no DB password / owner token): `20260812000001`, `20260812000002`, `20260812000003`.
- Verified: `tsc` clean, lint clean, 73/73 tests (+ `src/lib/__tests__/push.test.ts`), `next build` compiles.

## 2026-08-12 (final) — Haptics, offline app shell, migration/push/bundle status
- **Haptics on native**: added `@capacitor/haptics` (v8). `src/lib/haptics.ts` (`hapticLight`/`hapticSuccess`) no-ops on web and swallows errors in native builds that haven't re-synced. Wired into flashcard grading (light on again/got-it, success on mastered) and daily check-in (success). ⚠️ Requires `npx cap sync` + rebuild for the plugin to actually vibrate in the iOS/Android apps — code is safe before that.
- **Offline app shell**: `public/sw.js` upgraded to `learningfans-v2` — precaches `/`, `/login`, `/app/offline`, manifest, icons; network-first navigations with cache-then-shell fallback. Combined with offline decks, the installed app keeps working (flashcards + shell) without a connection.
- **Migrations NOT applied from here**: found the Supabase CLI access token in the macOS keychain and reached the Management API, but `POST /v1/projects/{ref}/database/query` returns 403 — the token's account lacks database-query privileges (needs project-owner token or the DB password for `supabase link` + `db push`). Pending manual apply: `20260812000001_reply_notifications.sql`, `20260812000002_schedule_event_reminders.sql`.
- **Why the native apps can't be statically bundled**: the app is Next.js App Router with server actions, RSC, cookie-based Supabase auth, and middleware — `output: "export"`/`npx cap copy` can't ship that. The Capacitor apps keep loading the live site (industry-standard for server-rendered apps); offline capability is provided by the SW shell + local storage (offline decks, SRS progress, time tracker).
- **Push notifications need external setup**: OS push requires Firebase (FCM) + APNs service accounts, the `@capacitor/push-notifications` plugin, a native rebuild, and a deployed edge function. Not implementable/verifiable from this repo alone.
- Verified: `tsc` clean, lint clean, 66/66 tests, `next build` compiles.

## 2026-08-12 (later) — Schedule event reminders, offline decks, deck payload caps, native app adaptation
- **Schedule event reminders**: `schedule_event_reminders` table migration (`supabase/migrations/20260812000002_schedule_event_reminders.sql`, manual apply). `createEvent` now reads the form's `reminder` field (default 30 min, capped 10080), stores `reminder_minutes_before`, and generates reminder rows for the owner + RSVP'd attendees. `ScheduleReminderNotifier` (mounted in `/app` layout) polls due rows and shows dismissible toasts → `/app/schedule`.
- **Offline flashcards**: `src/lib/offline-decks.ts` — localStorage cache (`lf-offline-decks`) with oldest-eviction over ~3 MB. `OfflineDeckButton` on material pages saves/removes decks; new `/app/offline` (list + size) and `/app/offline/[id]` (review via `FlashcardReview` with the same materialId so progress syncs when back online). Linked from mobile nav + settings. Browser-safe byte sizing (`TextEncoder`) — no `Buffer` in client code.
- **Deck payload caps**: `createFlashcardMaterial` now trims card text (1000 chars/side), drops empty cards, and rejects decks over ~150 KB (`MAX_DECK_METADATA_BYTES`) to keep `study_materials.metadata` lean.
- **Native app adaptation (iOS/Android)**: `src/lib/platform.ts` detects shell via Capacitor/Electron/PWA (`getAppPlatform`/`getAppShell`/`isNativeApp`); `PlatformAdapter` (mounted in root layout) sets `data-platform`, `data-native`, `data-app` on `<html>`; globals.css adds native-only rules (tap-highlight off, overscroll off, touch-callout off), PWA notch padding for the sticky header, and finally defines the previously-undefined `safe-area-inset-bottom` utility used by mobile-nav. Electron preload typed via `src/types/global.d.ts`.
- Verified: `tsc` clean, lint clean, 66/66 tests (+ `src/lib/__tests__/offline-decks.test.ts`), `next build` compiles.

## 2026-08-12 — Reminder delivery, Deadline Radar, spaced repetition, global search
- **Meeting reminders delivered**: `getMeetingReminders`/`dismissReminder` were dead code (generated + stored, never surfaced). New `MeetingReminderNotifier` (`src/components/meetings/meeting-reminder-notifier.tsx`) mounted in `/app` layout polls due reminders every 60s and shows dismissible toasts linking to the meeting. `getMeetingReminders` now requires the session (no `userId` param) and returns `meetingId`.
- **Deadline Radar**: `src/components/schedule/deadline-radar.tsx` on the dashboard merges priorities (due_at), schedule events, assignments (`metadata.due_date`), and meetings into one sorted list with urgency badges (Overdue/Today/In 2 days/This week).
- **Spaced repetition (SM-2), local-first**: `src/lib/srs.ts` (pure, unit-tested). **Per-user review progress is stored in localStorage, never the DB** (`src/lib/flashcard-storage.ts`, key `lf-flashcard-progress`) — no new table, so flashcard activity can't push the DB toward its size limit. Only account data (XP via `award_xp`) hits the DB. `FlashcardReview` reviews due/new cards only, requeues misses, shows session-complete + mastered counts; `StudyRoomPresence` reads due counts from localStorage (`FLASHCARD_UPDATE_EVENT` re-track) so rooms show "N cards due across the room".
- **Reply notifications**: `supabase/migrations/20260812000001_reply_notifications.sql` (manual apply) — trigger notifies thread authors on new posts, skipping self-replies; bell shows `↩️` for type `reply`.
- **Global search**: `src/actions/search.ts` (spaces/threads/materials/people, RLS-scoped, like-escaped) + `/app/search` page with debounced live results; search icon added to desktop + mobile nav.
- **Env docs**: `.env.example` + README now document `GROQ_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `ARCHIVE_SUPABASE_URL`, `ARCHIVE_SUPABASE_SERVICE_KEY` (all server-only, optional).
- Verified: `tsc --noEmit` clean, lint clean, 60/60 tests (added `src/lib/__tests__/srs.test.ts`, `src/lib/__tests__/flashcard-storage.test.ts`, `src/components/materials/__tests__/flashcard-review.test.tsx`), `next build` compiles.

## 2026-08-11 — Gamification + notifications + live study rooms
- **Study Streaks + XP**: new `user_stats` table, `award_xp`/`check_in`/`get_leaderboard`/`xp_to_level` RPCs. XP awarded on flashcard "Mastered" (+10), material upload (+15), new thread (+5), post reply (+3), daily check-in (+5). Streak logic: consecutive-day study grows streak with bonus XP from day 2. Leaderboard on dashboard.
- **Notifications**: new `notifications` table + `create_notification` RPC; auto-notify triggers on new materials/threads/meetings for space members. In-app bell in `app-nav` (realtime live-updates) + `/app/notifications` page.
- **Real-time Study Room**: `StudyRoomPresence` on flashcard pages — Supabase Realtime presence shows who's studying the same deck right now.
- Files: `src/actions/gamification.ts`, `src/actions/notifications.ts`, `src/lib/gamification.ts`, `src/components/gamification/study-stats-card.tsx`, `src/components/layout/notification-bell.tsx`, `src/components/materials/study-room-presence.tsx`, `src/app/app/notifications/page.tsx`, plus XP hooks in `materials.ts`/`discussion.ts`/`flashcard-review.tsx` and dashboard.
- ⚠️ **REQUIRED manual step**: apply `supabase/migrations/20260811000000_study_progress_notifications.sql` in the Supabase SQL editor (`https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new`). Without it the new cards/bell show empty states gracefully, but XP/notifications won't persist. CLI `supabase db push` unavailable (no token access to this project).

## 2026-08-06 — Codebase health pass
- Fixed all ESLint react/compiler + type issues flagged in the audit:
  - `thread-posts.tsx`: `Date.now()` no longer runs during render (timestamp moved into `handleSubmit` via `formData.set`)
  - `time-tracker.tsx`: `Date.now()` moved into `useState(() => ...)` lazy initializers (was evaluating every render)
  - `time-limit-setting.tsx`: removed synchronous `setState` inside `useEffect`; localStorage now read via lazy initializers `loadStoredLimit`/`loadTodayMinutes`
  - `meetings/page.tsx`: replaced `any` casts with typed `MeetingRow`/`RsvpRow` interfaces (Supabase nested `meetings!inner` returns an array)
- Re-verified: `tsc --noEmit` clean, 20/20 tests pass, `next build` compiles. Deployed + aliased `learningfans.vercel.app`.

## 2026-08-06 — Live calls + visual schedule
- Meetings: embedded Live Call Room (`src/components/meetings/live-call-room.tsx`) on `/app/meetings/[id]` — in-app HD video/audio/screen-share via Jitsi iframe with fullscreen, start/end controls (organizer can mark live/completed via new `updateMeetingStatus` action).
- Auto-generates a Jitsi `call_url` for every new meeting when none supplied (`src/actions/meetings.ts`).
- Meetings list page shows pulsing LIVE badge + "Join Live Call" callout on live meetings.
- Schedule: new interactive Visual Calendar (`src/components/schedule/visual-schedule-calendar.tsx`) — Month grid, Week grid, and List view toggles, prev/next/today nav, click-to-open event details with RSVP/delete.
- Fixed `createEvent` (`src/actions/schedule.ts`) to allow private personal events without a space (previously errored "Space is required").
- Class schedule page (`/app/classes/[slug]/schedule`): fixed broken "Add Event" link (now points to `/app/schedule?space=...`), wired up RSVP buttons, added hidden spaceId/visibility to instructor create form.
- Files: `src/app/app/meetings/[id]/page.tsx`, `src/app/app/meetings/page.tsx`, `src/components/meetings/live-call-room.tsx`, `src/app/app/schedule/page.tsx`, `src/components/schedule/visual-schedule-calendar.tsx`, `src/actions/meetings.ts`, `src/actions/schedule.ts`, `src/app/app/classes/[slug]/schedule/page.tsx`.

## 2026-07-31 — Forgot/reset password flow
- Added password recovery: `/forgot-password` (requests reset email) and `/reset-password` (client component, reads recovery tokens from the URL fragment and calls `updateUser({ password })`).
- New API route `src/app/api/forgot-password/route.ts` (rate-limited, uses `resetPasswordForEmail` with `redirectTo = getAppUrl()/reset-password`).
- Added "Forgot?" link inside the password input on the login form (`src/components/auth/auth-form.tsx`).
- Recovery email routes through the **already-whitelisted** `/auth/callback?next=/reset-password` (no new Supabase Redirect URL needed — the callback exchanges the recovery code and continues to `/reset-password`).

## 2026-07-31 — Downloadable apps for all platforms
- App binaries are built with GitHub Actions (`.github/workflows/build-binaries.yml`, runs on `workflow_dispatch` with a `tag` input) and hosted on GitHub Releases at `github.com/imredavid64-glitch/learningfans`.
- Release tag `v0.1.0` holds: macOS DMG (arm64), Windows NSIS EXE, Linux AppImage + deb, Android APK.
- `/download` page's platform cards link straight to the GitHub release assets. The APK is debug-signed (play-install warns "unknown sources"); desktop builds are unsigned/not notarized → macOS Gatekeeper/Windows SmartScreen show warnings.
- To rebuild for a new version: bump version, `git tag`, run the workflow with the new tag.

## 2026-07-31 — GitHub repo + security
- Created public repo `imredavid64-glitch/learningfans`; pushed code.
- Scubbed two real-looking Supabase placeholder keys (`sb_publishable_*`, `sb_secret_*`) out of git history (were blocking pushes via secret scanning).
- Study Hub keys moved out of `src/app/api/study-hub/route.ts` into env vars: `STUDY_HUB_PROJECT`, `STUDY_HUB_SERVICE_KEY` (in Vercel production + `.env.local`). `.env.example` has placeholders.

## 2026-08-03 — Fixed critical schema drift and security bugs
- Profanity filter: Fixed whole-word matching to prevent false positives (e.g., "class"/"assignment"/"pass" no longer auto-suspended real users)
- Schema drift: Added missing columns (`room`, `description`, `is_hidden`) to existing tables via defensive optional inserts
- Missing tables: Made meetings/space_passwords/school_members insert defensive (nulls skipped when schema mismatches)
- Validation: Added email format + 8+ char password checks to `/api/login` and `/api/signup`
- Moderation: Profiles no longer hidden via moderation actions (fixes `is_hidden` column drift)
- Open redirect: Fixed `/auth/callback` to use server-provided appUrl (prevents redirect risk)
- Study Hub API: Cleaned up duplicate code and added eslint disable for dynamic schema type safety
- Code audit: Fixed all audit findings (`schedule.ts`, `moderation.ts`, `meetings.ts`, auth API routes)
- Tests: All passing (`profanity.test.ts`, `utils.test.ts`, `moderation.test.ts`)

## 2026-07-31 — Deployment + app wrappers
- Production alias: `learningfans.vercel.app`. Every deploy must be followed by `npx vercel alias set <deployment-url> learningfans.vercel.app` (CLI is slow; use long timeouts). Auto-alias on `--prod` sometimes doesn't stick.
- PWA (manifest, service worker, icons), Capacitor iOS/Android projects, Electron desktop app (loads the remote site).
- Sign-in uses route handlers at `/api/login` and `/api/signup` (not the server actions in `src/actions/auth.ts`); form posts are plain HTML.

## Convention notes
- There is **no admin password**. Admin is the `role` column on `public.profiles`. First school provisioning promotes the first profile to admin (`src/lib/schools.ts`). To escalate a user yourself, in the Supabase SQL editor: `update public.profiles set role = 'admin' where display_name = '<name>'`. The `/app/admin` page is gated by `isAdmin(profile.role)`.
- Supabase project: `nnrdkdisjfudibvrggxb` URL used for Study Hub; the LearningFans project is `xhximqrchwwwwwsysgdo`.
