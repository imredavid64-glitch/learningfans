# LearningFans — Feature Brainstorm & Roadmap

Living document. Everything below is a candidate, not a promise. Ideas are tagged
by effort (`S` = small, `M` = medium, `L` = large) and impact (`🔥` = high).

> Last updated: 2026-08-13 — added section 8 (brainstorm) with effort/impact tags.

---

## 1. Make communication even easier

- ✅ **@mentions + notifications in rooms** — shipped 2026-08-12: `@name`
  autocomplete in the composer, highlighted mentions in messages, and a
  `create_notification` ping through the existing bell (`mention` type, 👋).
  Only space members are notified in space-linked rooms. Next step: parse plain
  `@name` text (no picker) and notify by display name too.
- ✅ **Reactions on messages** — shipped 2026-08-12: 👍 🎉 ❤️ 🔥 😄 🙏 on room
  chat messages, realtime via `study_room_message_reactions` + postgres_changes.
  Next step: per-user tooltips listing who reacted.
- ✅ **Presence cursors on the whiteboard** — shipped 2026-08-12: each person in
  the room sees the others' pointer as a colored dot + name pill on the board.
  Powered by Realtime presence on the board channel (`{x, y}` tracked at ~10 Hz,
  auto-cleaned when someone disconnects); per-user colors derived from a palette
  hash (`cursorColor`). Next step: cursors in the chat + room canvas thumbnails.
- ✅ **Community rules + mod announcements + content filters** — shipped
  2026-08-12 (Reddit-for-learners Phase 1): numbered `spaces.rules` in the
  About sidebar (mod-editable), 📌 `spaces.announcements` pinned cards, and
  All/PDFs/Images/Files/Links/Notes/Quizzes filter chips on the materials feed.
  Full blueprint in `docs/REDDIT_FOR_LEARNERS.md`.
- ✅ **Thread voting + Hot/New/Top/Controversial sorting** — shipped 2026-08-12
  (Phase 2a): up/down vote clusters on thread cards (`post_votes` table,
  `threads.score/ups/downs` cached by trigger), feed sorts with pinned threads
  always on top (`src/lib/thread-ranking.ts`, unit-tested). Next: flairs, then
  community directory.
- ✅ **Quiz posts + community leaderboard** — shipped 2026-08-12 (Phase 3a):
  create a quiz in a space (`quiz` material type), take it inline with instant
  server-side grading + per-question review, best score lands on a top-10
  community leaderboard (`quiz_attempts`, one row per user per quiz). Next from
  the blueprint: PDF posts with in-feed preview + image lightboxes.
- ✅ **Post flairs** — shipped 2026-08-12 (Phase 2b): mod-defined color-coded
  labels per community (`spaces.flairs` jsonb, 8-color palette, validated in
  `src/lib/community.ts`); thread form select + author/mod change control;
  colored chips on feed cards and thread pages.
- ✅ **Community branding + directory** — shipped 2026-08-12 (Phase 2b round 2):
  mod-uploaded icon + banner images (public `community-assets` bucket,  sharp compression), banner/icon header on space pages, and a browsable, searchable
  `/app/communities` directory (member + flair counts).
- ✅ **PDF posts + image lightbox** — shipped 2026-08-12 (Phase 3b): PDF
  materials open an inline preview pane (proxy route streams private-bucket
  bytes with `Content-Disposition: inline`); image materials get thumbnails in
  the feed and a fullscreen `ImageLightbox`.
- ✅ **Quiz results → review queue** — shipped 2026-08-12 (Phase 3a round 2):
  "Add to my review queue" turns missed questions into an SM-2 flashcard deck
  (server-built cards, idempotent, reload-safe).
- ✅ **Nested (threaded) replies** — shipped 2026-08-12: posts render as a
  Reddit-style comment tree (`posts.parent_id`, same-thread validation, parent
  author gets a bell notification too).
- ✅ **Community home feed** — shipped 2026-08-12 (Phase 4): `/app/feed` — a
  combined chronological timeline of discussions + materials (quizzes,
  flashcards, files…) across your communities with All/Discussions/Materials
  filters.
- ✅ **Save / bookmark collections** — shipped 2026-08-12: bookmark threads,
  materials, and quizzes; `/app/saved` groups them into named folders with
  move-between-folder controls.
- ✅ **Weekly community digest** — shipped 2026-08-12: a `digest` notification
  every Monday (cron `/api/cron/digest`) summarizing new discussions,
  materials, and replies across your communities, linking to `/app/feed`.
- ✅ **Mod dashboard + automod** — shipped 2026-08-12: per-community
  `/app/spaces/[slug]/moderation` with keyword automod rules (flag/remove,
  thread/reply scope) enforced in thread/post creation, plus the community's
  mod action history. Also fixed space-mods reading the log + auto_flag
  logging.
- ✅ **AI coverage hardening** — shipped 2026-08-12: AI moderation extended to
  every creation surface (notes, links, flashcard decks, quizzes, file titles,
  announcements, meetings) with a prompt that now also flags promotional
  content and requires content to stay educational.
- ✅ **Community leaderboard** — shipped 2026-08-12: per-community rankings by
  XP (level + streak) or contributions (threads/materials/replies), medals +
  mod badges, caller highlighted. Next: karma/trophies.
- ✅ **Threaded replies in room chat** — shipped 2026-08-18: replies nest up to 3
  levels (`buildMessageTree`, deeper replies flatten onto depth 2); per-message
  Reply button + "Replying to…" composer chip; `study_room_messages.parent_id`
  (migration `20260818000001`); offline queue carries `parentId`.
- **Voice rooms** (`L`): persistent voice channels (like Discord) using LiveKit or
  Jitsi's audio-only mode, so people can hang out and talk while studying without
  booking a "meeting".
- **Push the realtime layer**: rooms today need the app open. Web push already
  exists for reminders — extend it to "someone drew on your board / @mentioned you".

## 2. Streamline the app (make the core loop tighter)

- **Consolidate the three "study together" surfaces** (`M`): Meetings (scheduled
  calls), Study Rooms (live rooms), and flashcard presence all overlap. Proposal:
  meetings stay for *scheduled* events; study rooms become the default *spontaneous*
  entry point, and flashcard presence links into a room for that deck.
- **Personal quick actions** (`S`): replace the static nav with a "recently used"
  row (recent rooms, recent spaces) on the dashboard.
- ✅ **Onboarding checklist** — shipped 2026-08-18: first-run card walks users
  through 6 steps (complete profile → join a space → first material → first
  discussion → take a quiz → check in) with a progress bar; hides itself once
  complete (`src/lib/onboarding.ts` + dashboard card).
- **Command palette (⌘K)** (`M`): shipped 2026-08-19 — one search box for spaces, rooms, materials, people, and quick actions (`⌘K` / `Ctrl+K`), with debounced search and shortcut helper.
- **User Profile Hover Cards** (`S`): shipped 2026-08-19 — hover any user name in room chat or discussions to inspect their avatar, major/role, level, XP, streak, and quick profile link.
- **Copy Link Button** (`S`): shipped 2026-08-19 — reusable share button with clipboard toast feedback.
- **Social Collaboration XP**: shipped 2026-08-19 — awarded XP for social participation (`room_host` +5 XP, `room_chat` +2 XP, `whiteboard_teamwork` +10 XP).
- **Notification Triage & Center** (`S`): shipped 2026-08-19 — category tabs, unread filters, per-item mark read, and bulk "Mark all read".
- **Declutter the demo/creator/fan mode** (`M`): it was a hackathon showcase; if it
  isn't driving signups, move it behind a setting or drop it to shrink the nav.
- **Notifications triage** (`S`): group by type (material / thread / meeting /
  reply / room) with "mark all read" — the bell already gets busy.

## 3. Study tools

- **Shared document / notes in rooms** (`M`): a collaborative markdown pane next to
  the whiteboard (broadcast deltas, debounced snapshot like the whiteboard).
- **Room-linked flashcards** (`M`): create/queue a deck *inside* a room so everyone
  reviews the same cards; due counts already drive presence badges.
- ✅ **Whiteboard image export / sharing** — shipped 2026-08-13: "Download PNG"
  button (canvas `toDataURL`) plus a "pin board to space" action that stores the
  board as an image material (`pinWhiteboardToSpace` — client 2x PNG render,
  sharp ≤1920px, `materials` bucket + `file` material with `metadata.mime`).
- ✅ **Per-user whiteboard colors** — shipped 2026-08-13: strokes are stamped
  with `author_id`/`author_name`; a "Person" toggle renders each author's
  strokes in their deterministic palette color (the same one their presence
  cursor uses, via `strokeRenderColor`), with a "who drew what" legend under the
  toolbar. Exported PNGs honor the toggle too.
- **More whiteboard tools** (`M`): shapes (rect/arrow/line), text tool, background
  grid toggle.
- **Ambient focus rooms** (`M`): rooms with a shared lofi/rain sound toggle (Web
  Audio), synced with the pomodoro.

## 4. Gamification & community

- **Room XP** (`S`): +2 XP for posting in a room chat, +5 for hosting a room, streak
  bonus for joining a room 3 days straight. Wires into the existing leaderboard.
- **Study parties** (`M`): scheduled public rooms with a countdown; leaderboard shows
  "most minutes studied together this week" per space.
- ✅ **Wall of fame** — shipped 2026-08-18: weekly spotlight card on the dashboard
  for this week's top XP earners (`user_stats.weekly_xp` + `get_weekly_leaderboard`
  RPC, migration `20260818000000`; `award_xp`/`check_in` rewritten with ISO-week
  accumulation + auto-reset).

## 5. Native & platform

- ✅ **True offline rooms** — shipped 2026-08-13 (see §8 moonshots): chat
  messages and whiteboard snapshots queue in localStorage while offline and
  replay on reconnect — a huge win for the Capacitor apps, which currently load
  the live site.
- **System notifications for room activity** (`M`): FCM/APNs via
  `@capacitor/push-notifications` once the service-account setup is available.
- **Whiteboard on mobile** (`S`): pointer events already work — polish the toolbar
  for touch (bigger swatches, palm rejection via `touch-action: none` which we set).

## 6. Trust & safety at scale

- ✅ **Room moderation + rate limits** — shipped 2026-08-13: hosts (creator /
  app mod / space mod) get a **Moderate** panel listing live participants with
  mute (10 min) and ban controls; muted users can't chat, banned users can't
  chat or save the whiteboard (`study_room_moderation` table + hardened chat
  insert policy). Chat is rate-limited to 6 messages/15s per user (DB-counted,
  so it holds across serverless instances).

## 7. Data & cost (free-tier discipline)

- Rooms are free-tier friendly by design: whiteboard snapshots are capped (~256 KB,
  600 strokes) and stored as a single `jsonb` column; chat is the only row-heavy
  table and it's capped at 100 messages on load with lazy pagination. If chat grows,
  add: message pruning after N days, and/or an archive bucket like `archive.ts`
  already does for other data.

---

## Shipped recently (context)

- **2026-08-12** — **Batched AI moderation for room chat**: the send path now
  runs only fast local checks (no Groq round-trip per message); each message is
  enqueued in `chat_moderation_queue` and AI-reviewed in batches of 15 via
  `/api/moderation/chat` (atomic SQL claim, one Groq request per batch,  hidden +
  logged + escalated when flagged). Flush is kicked fire-and-forget after the
  send (`after()`) with the daily push cron as a safety net; migration
  `20260812000015_chat_moderation_queue.sql` (manual apply).
- **2026-08-12** — Whiteboard **presence cursors**: live colored dots + name pills
  for everyone currently in the room, synced via Realtime presence on the board
  channel (`{x, y}` throttled to ~10 Hz, hidden on pointer-leave, auto-cleaned on
  disconnect). Deterministic per-user color from `cursorColor(userId)`.
- **2026-08-12** — Room chat **@mentions + emoji reactions**: `@` autocomplete
  against space members (or all profiles in open rooms), highlighted `@name`
  rendering, bell notifications (`create_notification`, type `mention`), and
  realtime reactions (👍 🎉 ❤️ 🔥 😄 🙏) stored in the new
  `study_room_message_reactions` table (`20260812000005_study_room_reactions.sql`,
  manual apply).
- **2026-08-12** — Interactive Study Rooms: join live rooms,
  shared realtime whiteboard (pen/eraser/undo/clear, broadcast + debounced
  snapshot), persisted room chat (RLS + postgres_changes realtime), shared pomodoro
  focus timer (broadcast-synced, survives refresh via localStorage), live presence
  avatars, one-click Jitsi video call, invite links. Hub at `/app/study-rooms`,
  rooms at `/app/study-rooms/[id]`, entry points in nav + dashboard + space pages.
- **2026-08-11** — Study streaks + XP, notification bell, live study-room presence on
  flashcards.
- **2026-08-06** — Live calls (Jitsi) + visual schedule calendar.

---

## 8. Brainstorm (2026-08-13)

Fresh territory on top of the shipped Reddit-for-learners core. Tagged by effort
(`S` = small, `M` = medium, `L` = large) and impact (`🔥` = high).

### Cheap wins (existing infra, one feature each)

- ✅ **Live quiz battles in study rooms** — shipped 2026-08-18: host picks a quiz
  (public-space or room-space only — no private-content leak), questions broadcast
  with answers stripped; everyone answers locally, the host grades and broadcasts
  live standings (🥇🥈🥉); participants auto-record their attempt via the existing
  `submitQuizResult` (server-authoritative regrade + XP + integrity guard). The
  Kahoot moment — the single most shareable feature for a study app.
- ✅ **Karma / trophies** — shipped 2026-08-18: trophy badges for "First 100 XP" up
  through 10k XP, 7/30-day streaks, plus identity/joiner/community-builder badges,
  with a "next trophy" nudge on the profile page (`src/lib/trophies.ts`). (Net-upvote
  karma next to usernames remains future work — data lives in `post_votes`.)
- **AI "Explain this" on any post/material** (`S`) — Groq is already wired into
  moderation; reuse it student-facing: "Explain this PDF/note/answer like I'm 12"
  with a citation of the source. Turns every resource into a tutor.
- ✅ **Whiteboard → PNG → pin as material** — shipped 2026-08-13 (see §3 study
  tools above).
- ✅ **Parent progress digest** — shipped 2026-08-13: a monthly `parent_digests`
  row per student (XP, level, streak, 30-day contributions, XP delta vs last
  month) generated by the `send_parent_digests()` RPC on the Monday cron; the
  student gets a bell ping and can view the report in Settings. `parent_email`
  is now settable in Settings (not just the restricted-account banner). Email
  delivery is queued (`status` column) — still needs an email provider.
- **Chat rate limits + room kick/mute** (`S`/`M`) — `rate-limit.ts` exists for chat
  flood; hosts get kick/mute like meeting organizers. Trust & safety before scale.
- **Per-user whiteboard colors** (`S`) — roadmap item; tells you who drew what,
  pairs with the existing presence cursors.

### The engagement loop (community retention)

- ✅ **"Ask the community" post type** — shipped 2026-08-13: threads gain a
  `kind` (`discussion` | `question`); questions require a **"what I've tried"**
  field (r/learnmath pattern, validated in `createThread`) and render it in a
  highlighted block. The author or a moderator can **mark the official answer**
  (`markOfficialAnswer` → `threads.accepted_answer_id`); accepted replies get a
  green "Official answer" badge, and question threads show Question/Answered
  badges in the feed. Migration `20260813000003`.
- ✅ **Study parties** — shipped 2026-08-13: study rooms gain an optional
  `starts_at` (scheduled via the room form); the hub shows **upcoming parties**
  with a live ticking countdown (`PartyCountdown`) and **open rooms** separately.
  A shared pomodoro focus completion records a `study_sessions` row (deduped by
  `focus_key` so one 25-min block counts once per participant), powering the
  **"most minutes studied together this week"** leaderboard
  (`get_study_party_leaderboard`). Migration `20260813000004`. **RSVP +
  reminders** (2026-08-13, migration `20260813000007`): attendees RSVP on the
  hub cards / room banner (attendee count), and each RSVPer gets a
  `party_reminder` bell notification ~15 min before start — fired by a sweep
  (`sendPartyReminders`) that runs lazily on hub/room page loads plus the daily
  push + weekly digest crons; RSVPing to a party starting within 30 min reminds
  instantly. `reminded_at` dedupes. **Auto-end** (2026-08-13): when the last
  participant leaves a started party, the room's presence watcher fires
  `autoEndPartyWhenEmpty` (guarded to the creator / RSVP / study-session
  participants) and the room flips to `ended`, dropping off the hub.
- **AI-generated flashcards from notes/PDFs** (`M`) — Gemini is already integrated.
  "Turn this PDF into a 20-card deck" → straight into the SM-2 review queue. Massive
  study-time saver.
- ✅ **Accountability groups** — shipped 2026-08-13: small groups (max 8) with a
  shared weekly goal; members check in daily (`accountability_checkins`),
  progress bars show % checked in this week, a **group streak** counts
  consecutive all-member days (today is in-progress), and **gentle peer nudges**
  ping members through the existing bell (24h cooldown). `/app/groups` hub +
  nav links. Migration `20260813000005`.

### Moonshots

- **Voice rooms** (`L`) — persistent Discord-style audio channels via LiveKit so
  people "hang out while studying" without booking a meeting.
- ✅ **Offline-first rooms** — shipped 2026-08-13: `src/lib/offline-room-sync.ts`
  (localStorage layer — chat queue + pending whiteboard snapshot, 50-msg cap,
  shared change event, 11 unit tests). `RoomChat` queues messages on
  offline/network failure, renders them optimistically as "queued", and flushes
  in order on the `online` event (a delivered message confirms its queued copy);
  `Whiteboard` keeps a local snapshot when a save fails and replays it on
  reconnect with a "Saved locally" badge. Last-writer-wins (matching the
  existing snapshot model), not a true CRDT merge.
- ✅ **Community RAG tutor** — shipped 2026-08-13: `src/lib/community-rag.ts`
  (lexical retrieval — keyword overlap with a title boost, not embeddings) builds
  a corpus from the community's own **notes, flashcards, quizzes, links, files,
  threads, and posts**, ranks the top 6 against the question, and answers via
  Groq grounded in those chunks with **citation chips** back to each source.
  `askCommunityTutor` (membership/public-gated, local profanity check, 500-char
  cap) powers the **"Community librarian"** card in the space sidebar. **Gap:**
  PDFs/files are indexed by title/description only — full-text extraction needs a
  PDF parser (or embeddings + pgvector) as a follow-up.
- ✅ **Quiz plagiarism / cheating guard** — shipped 2026-08-13:
  `src/lib/quiz-integrity.ts` analyzes the per-question **answer-time
  fingerprint** (client sends latency from each question's first-shown to
  first-answered, plus total time) and flags suspiciously-fast submissions
  (perfect + implausibly-fast total, fast median, or >50% instant answers). A
  flagged attempt never advances `best_score_pct`, earns no XP, and shows a
  "too fast to grade" notice — the leaderboard stays honest. The fingerprint is
  stored on `quiz_attempts` (`total_ms`, `answer_times_ms`, `flagged`,
  `flag_reasons`; migration `20260813000006`). Degrades gracefully pre-migration
  (guard inactive).

### Suggested build order

1. ✅ **Karma/trophies + AI explain** — trophies shipped 2026-08-18; "AI explain"
   (`S`) still open.
2. ✅ **Live quiz battles** — shipped 2026-08-18 (the feature people will actually
   tell friends about).
3. ✅ **"Ask the community" + official answers** — shipped 2026-08-13 (community
   depth).
4. **Whiteboard export + room XP** — whiteboard export/pin shipped 2026-08-13;
   room XP (`S`) still open.
5. Then pick a moonshot based on how rooms get used.
