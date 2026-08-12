# LearningFans — Feature Brainstorm & Roadmap

Living document. Everything below is a candidate, not a promise. Ideas are tagged
by effort (`S` = small, `M` = medium, `L` = large) and impact (`🔥` = high).

> Last updated: 2026-08-12 — after room chat got **@mentions** (bell notifications,
> autocomplete) and **emoji reactions** (realtime). Interactive Study Rooms shipped
> earlier the same day: live whiteboard, room chat, shared pomodoro, presence,
> one-click video call.

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
- **Threaded replies in room chat** (`M`): hover a message → "reply", replies nest
  under it. Chat gets long in live rooms; threading keeps it scannable.
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
- **Onboarding checklist** (`M`): first-run card walks users through join a space →
  set a priority → do a check-in → join a study room. We know every step's XP hook
  already exists.
- **Command palette (⌘K)** (`M`): one search box for spaces, rooms, materials,
  people, and actions ("start a room", "schedule a meeting"). Search exists; wrap it.
- **Declutter the demo/creator/fan mode** (`M`): it was a hackathon showcase; if it
  isn't driving signups, move it behind a setting or drop it to shrink the nav.
- **Notifications triage** (`S`): group by type (material / thread / meeting /
  reply / room) with "mark all read" — the bell already gets busy.

## 3. Study tools

- **Shared document / notes in rooms** (`M`): a collaborative markdown pane next to
  the whiteboard (broadcast deltas, debounced snapshot like the whiteboard).
- **Room-linked flashcards** (`M`): create/queue a deck *inside* a room so everyone
  reviews the same cards; due counts already drive presence badges.
- **Whiteboard image export / sharing** (`S`): "Download PNG" button (canvas
  `toDataURL`) and a "pin board to space" action that stores it as a material.
- **More whiteboard tools** (`M`): shapes (rect/arrow/line), text tool, background
  grid toggle, per-user stroke colors so you can tell who drew what.
- **Ambient focus rooms** (`M`): rooms with a shared lofi/rain sound toggle (Web
  Audio), synced with the pomodoro.

## 4. Gamification & community

- **Room XP** (`S`): +2 XP for posting in a room chat, +5 for hosting a room, streak
  bonus for joining a room 3 days straight. Wires into the existing leaderboard.
- **Study parties** (`M`): scheduled public rooms with a countdown; leaderboard shows
  "most minutes studied together this week" per space.
- **Wall of fame** (`S`): weekly spotlight card on the dashboard for top XP earners
  in your spaces.

## 5. Native & platform

- **True offline rooms** (`L`): queue whiteboard strokes + chat locally and sync
  when back online (localStorage + broadcast catch-up) — a huge win for the
  Capacitor apps, which currently load the live site.
- **System notifications for room activity** (`M`): FCM/APNs via
  `@capacitor/push-notifications` once the service-account setup is available.
- **Whiteboard on mobile** (`S`): pointer events already work — polish the toolbar
  for touch (bigger swatches, palm rejection via `touch-action: none` which we set).

## 6. Trust & safety at scale

- **Room moderation** (`M`): room hosts get kick/mute controls (mirrors the meeting
  organizer model); chat messages already run through the profanity escalation
  pipeline.
- **Rate limits on room chat** (`S`): the app already has `src/lib/rate-limit.ts` —
  apply per-user/per-minute caps to `sendRoomMessage` to stop flood spam.

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
