# Features

A map of every feature area: routes, server actions, components, and behavior.
Server actions live in `src/actions/*.ts`; components in `src/components/*`.

## Auth & onboarding

- **Routes:** `/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/auth/callback`; handlers at `/api/login`, `/api/signup`, `/api/logout`,
  `/api/forgot-password`.
- **Behavior:** email + password (8+ chars). Signup sends a confirmation email;
  the callback exchanges the code and redirects via the server-provided app URL.
  Password recovery uses `resetPasswordForEmail` → `/reset-password` (reads the
  recovery token from the URL fragment). First login auto-creates a profile
  (`ensureProfile` in `src/lib/auth.ts`).
- **Files:** `src/components/auth/auth-form.tsx`, `src/components/auth/sign-out-button.tsx`.

## Dashboard (`/app`)

- Welcome header, **Study Stats card** (XP/level/streak/leaderboard),
  **Deadline Radar** (merged priorities + events + assignments + meetings by
  urgency), **"Study together" quick actions** (open room / schedule call /
  schedule), and cards for spaces, top priorities, upcoming events.
- **Files:** `src/app/app/page.tsx`, `src/components/gamification/study-stats-card.tsx`,
  `src/components/schedule/deadline-radar.tsx`.

## Spaces & discussion

- **Routes:** `/app/spaces`, `/app/spaces/[slug]` (+ `materials`, `materials/[id]`,
  `threads/[id]`).
- **Spaces:** create (name, slug, description, public toggle, optional password),
  join, leave. Public spaces are browsable; private ones require membership.
- **Discussion:** threads (pin/lock/hide by mods), posts with **realtime** via
  `postgres_changes` on `posts` (same pattern as thread posts — see
  `src/components/discussion/thread-posts.tsx`). Replies auto-notify the thread
  author (migration 0001).
- **Actions:** `src/actions/spaces.ts`, `src/actions/discussion.ts`.

## Study materials & priorities

- **Types:** file, link, note, flashcard_set.
- **Files:** uploaded to Supabase Storage (5 MB/file, 25 MB/user, images
  compressed via sharp); stored as signed URLs. Notes are text. Links are URLs.
- **Flashcards:** local-first SM-2 spaced repetition. Deck payloads live in
  `study_materials.metadata` (capped ~150 KB, 1000 chars/side, max 100 cards);
  **review progress lives in localStorage** (`lf-flashcard-progress`) so it never
  touches the DB. Grading (again/good/easy/hard), mastery, haptics, and a
  per-deck **study room presence** strip showing who's studying the same deck.
  Offline decks cache to localStorage (`lf-offline-decks`) with `/app/offline`.
- **Priorities:** `user_material_rankings` — urgent/high/normal/low with rank
  score; surfaced on `/app/priorities` and the dashboard.
- **Actions:** `src/actions/materials.ts`; **Files:**
  `src/components/materials/flashcard-review.tsx`,
  `src/lib/srs.ts`, `src/lib/flashcard-storage.ts`, `src/lib/offline-decks.ts`.

## Schedule

- **Routes:** `/app/schedule`, `/app/classes/[slug]/schedule`.
- Personal + space events (visibility `private`/`space`), all-day support, RSVPs
  (`event_attendees`), **Visual Calendar** (month/week/list with prev/next/today,
  click-to-open details), **event reminders** (migration 0002) delivered as toasts
  by `src/components/schedule/schedule-reminder-notifier.tsx`.
- **Actions:** `src/actions/schedule.ts`.

## Meetings & live calls

- **Routes:** `/app/meetings`, `/app/meetings/new`, `/app/meetings/[id]`.
- Scheduled calls with RSVP (going/maybe/decline), auto-generated **Jitsi**
  `call_url`, embedded **Live Call Room** (HD video/audio/screen-share iframe,
  fullscreen, start/end controls, organizer-only status changes), LIVE badges,
  AI-generated reminders (Groq or plain-text fallback) delivered by
  `meeting-reminder-notifier.tsx`.
- **Actions:** `src/actions/meetings.ts`.

## Study rooms (interactive collaboration)

- **Routes:** `/app/study-rooms` (hub + create), `/app/study-rooms/[id]` (room).
- **Room features:**
  - **Whiteboard** — pen (6 colors × 4 widths), eraser, undo, clear; strokes
    broadcast live and snapshotted to `study_rooms.whiteboard` (600 strokes /
    256 KB caps); **presence cursors** show everyone's pointer as a colored dot +
    name pill (presence, ~10 Hz).
  - **Room chat** — persisted, realtime via `postgres_changes`; **@mentions**
    (autocomplete against space members or app profiles; pings via
    `create_notification`, type `mention`); **emoji reactions**
    (`study_room_message_reactions`, realtime); profanity-checked.
  - **Focus timer** — 25/5 pomodoro synced by broadcast (`endsAt`-based so
    everyone counts down together; pause/resume/skip/reset; auto focus→break;
    localStorage persistence).
  - **Presence avatars**, **one-click Jitsi video call**, **copy invite link**,
    host **End room** (read-only board + disabled chat afterwards).
- **Actions:** `src/actions/study-rooms.ts`; **Files:**
  `src/components/study-rooms/*`, `src/lib/study-room-utils.ts`.
- **Entry points:** desktop + mobile nav, dashboard quick actions, space pages
  (`/app/study-rooms?space=…` preselects the space).

## Gamification

- XP hooks: flashcard mastered (+10), material upload (+15), new thread (+5),
  post reply (+3), daily check-in (+5), consecutive-day streak bonus.
- Level = `xp_to_level(total_xp)` (100 XP/level). Leaderboard on dashboard.
- **Actions:** `src/actions/gamification.ts`; **Files:**
  `src/lib/gamification.ts`, `src/components/gamification/*`.

## Notifications

- Bell in the nav (realtime via `postgres_changes` on `notifications`), full
  page at `/app/notifications`, mark-read / mark-all-read.
- Types + icons: material 📄, thread 💬, reply ↩️, **mention 👋**, meeting 🎥,
  event 📅, streak 🔥, system 🔔.
- Sources: DB triggers (new material/thread/post/meeting) + server actions
  (room @mentions) via `create_notification`.
- **Web push:** VAPID-based; `POST /api/push/subscribe`, `GET /api/push/send`
  (cron target, guarded by `CRON_SECRET`, idempotent via `push_sent_at`,
  prunes dead subscriptions). Cron: daily 08:00 UTC (`vercel.json`). Service
  worker handles `push` + `notificationclick`.
- **Files:** `src/components/layout/notification-bell.tsx`,
  `src/app/app/notifications/page.tsx`, `src/lib/push.ts`, `public/sw.js`.

## Search

- `/app/search` — debounced live results across spaces, threads, materials, and
  people (RLS-scoped, like-escaped). **Actions:** `src/actions/search.ts`.

## Offline

- `/app/offline` + `/app/offline/[id]` — downloaded decks reviewed offline;
  PWA service worker precaches the app shell (network-first navigations,
  cache-then-shell fallback); offline decks localStorage cache (~3 MB cap).

## Moderation (see [Moderation](MODERATION.md))

- `/app/mod` — mod queue, reports, sanctions (warn/mute/suspend), hide content,
  pin/lock threads. `/app/admin` — roles, storage overview, schools.
- **Actions:** `src/actions/moderation.ts`, `src/actions/admin.ts`,
  `src/actions/schools.ts`.

## Schools / classes (tenant features)

- `/app/enrollments`, `/app/grades`, `/app/study-hub`, `/app/classes/[slug]/…`
  — class provisioning, enrollment, grade tracking, assignments, class schedule.
  Built on the multi-tenant school migrations; provisioning via the Supabase
  management API when `SUPABASE_ACCESS_TOKEN` is present.

## Demo & downloads

- `/demo` — public demo experience (demo mode: creator/fan feed).
- `/download` — platform cards linking to GitHub Release assets built by
  `.github/workflows/build-binaries.yml` (APK, Windows EXE, Linux AppImage/deb,
  macOS DMG). Desktop builds are unsigned; APK is debug-signed.

## Cross-cutting behavior

- **Demo mode** (`src/lib/demo-mode.tsx`): creator/fan feed toggles used for
  marketing/demo.
- **Haptics** (`src/lib/haptics.ts`): Capacitor haptics on native, no-op on web —
  wired into flashcard grading, check-in, room joins, notifications, whiteboard.
- **Archival** (`src/lib/archive.ts`): when `get_db_size` nears the free-tier
  cap, old data moves to a second Supabase project (`ARCHIVE_SUPABASE_*`).
