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
- **Community layer (Reddit-style):** each space shows an **About** sidebar with
  the moderator list and numbered **community rules** (`spaces.rules`, jsonb);
  moderators manage rules inline and post 📌 **announcements**
  (`spaces.announcements`, jsonb) that pin to the top of the community
  (`src/actions/community.ts`, `src/components/community/community-admin.tsx`).
  Space moderators + app moderators are gated by a dedicated RLS policy.
- **Discussion:** threads (pin/lock/hide by mods), posts with **realtime** via
  `postgres_changes` on `posts` (same pattern as thread posts — see
  `src/components/discussion/thread-posts.tsx`). **Nested replies** — every post
  has a Reply button opening an inline composer; replies render as a Reddit-
  style tree (indented, visually capped at 3 levels; migration 0011 adds
  `posts.parent_id`, validated same-thread server-side). Replies auto-notify the
  thread author *and* the parent comment author (migration 0001 + 0011).
- **Voting & sorting (Reddit-style):** thread cards show an up/down vote cluster
  (`post_votes` table, one row per user; `threads.score/ups/downs` cached by the
  `update_thread_score` trigger) and the feed sorts by **Hot / New / Top /
  Controversial** with pinned threads always on top
  (`src/components/community/thread-feed.tsx`, `src/lib/thread-ranking.ts`).
- **Actions:** `src/actions/spaces.ts`, `src/actions/discussion.ts`, `src/actions/community.ts`.

## Study materials & priorities

- **Types:** file, link, note, flashcard_set.
- **Files:** uploaded to Supabase Storage (5 MB/file, 25 MB/user, images
  compressed via sharp); stored as signed URLs. Notes are text. Links are URLs.
- **Flashcards:** local-first SM-2 spaced repetition. Deck payloads live in
  `study_materials.metadata` (capped ~150 KB, 1000 chars/side, max 100 cards);
  **  review progress lives in localStorage** (`lf-flashcard-progress`) so it never
  touches the DB. Grading (again/good/easy/hard), mastery, haptics, and a
  per-deck **study room presence** strip showing who's studying the same deck.
  Offline decks cache to localStorage (`lf-offline-decks`) with `/app/offline`.
  Uploads now record `metadata.mime` so the feed can filter by type.
- **Priorities:** `user_material_rankings` — urgent/high/normal/low with rank
  score; surfaced on `/app/priorities` and the dashboard.
- **Actions:** `src/actions/materials.ts`; **Files:**
  `src/components/materials/flashcard-review.tsx`,
  `src/lib/srs.ts`, `src/lib/flashcard-storage.ts`, `src/lib/offline-decks.ts`.

## PDF posts + image lightbox

- **Inline preview:** file materials render on `/app/spaces/[slug]/materials/[id]`
  — PDFs in an embedded **preview pane** (75vh iframe) with Download + open-in-
  new-tab, images as a large view with click-to-zoom.
- **Preview route:** `/app/spaces/[slug]/materials/[id]/preview` proxies the
  private-bucket bytes with `Content-Disposition: inline` (signed URL
  server-side, RLS-gated on `study_materials`), so browsers render PDFs in the
  iframe and images as plain `<img>` — no public bucket needed.
- **Lightbox:** `ImageLightbox` — fullscreen overlay, Escape/backdrop/X close,
  body scroll lock. Used on the detail page and inline in the materials list,
  where image materials show a thumbnail that opens the lightbox and PDFs get a
  **Preview** button.

## Schedule

- **Routes:** `/app/schedule`, `/app/classes/[slug]/schedule`.
- Personal + space events (visibility `private`/`space`), all-day support, RSVPs
  (`event_attendees`), **Visual Calendar** (month/week/list with prev/next/today,
  click-to-open details), **event reminders** (migration 0002) delivered as toasts
  by `src/components/schedule/schedule-reminder-notifier.tsx`.
- **Actions:** `src/actions/schedule.ts`.

## Materials feed filters

Reddit-style chip row on the materials page: **All / PDFs / Images / Files /
Links / Notes / Quizzes** (`src/components/materials/material-list.tsx` — MIME
aware, thanks to `metadata.mime` on uploads). This is the "find a PDF / quiz"
superpower of the Reddit-for-learners vision (see
[docs/REDDIT_FOR_LEARNERS.md](../docs/REDDIT_FOR_LEARNERS.md)).

## Post flairs (color-coded labels)

- **Define:** moderators manage a community's flair list in the admin panel
  (`CommunityAdmin` — up to 15, each a label + one of 8 fixed colors; palette and
  validation in `src/lib/community.ts`, unit-tested). Stored as `spaces.flairs`
  jsonb (migration 0009), same pattern as rules/announcements.
- **Apply:** the New thread form shows a flair select when the community has
  flairs; authors and moderators can change a thread's flair from its page
  (`ThreadFlairControl`). `flair_id` is validated against the community's list
  server-side (`createThread` / `setThreadFlair` in `src/actions/discussion.ts`).
- **Surface:** colored flair chips on thread cards in the feed (`ThreadFeed`)
  and on the thread detail page; the community feed has a **browse-by-flair**
  chip row (All + each flair) that narrows the feed, working with the
  Hot/New/Top/Controversial sort tabs.

## Community branding + directory

- **Branding:** moderators upload a square **icon** (256×256, sharp-cropped) and a
  wide **banner** (1600×400) from the admin panel — `BrandingUpload` compresses
  client-server via sharp, uploads to the public `community-assets` bucket
  (storage policies: public read, space-mod/app-mod writes), and stores the
  public URL on `spaces.icon_url` / `banner_url` (migration 0010).
- **Header:** the space page shows the banner across the top and the icon beside
  the community name (initial-letter fallback).
- **Directory:** `/app/communities` — browsable grid (icon, name, member count,
  flair count, public/private badge) with live client-side search over
  name/description/slug (`CommunityDirectory`). RLS already scopes it to public
  spaces + your memberships; member counts come from `space_members`
  (`can_read_space` policy). Linked from the desktop + mobile nav and the Spaces
  page.

## Quiz posts (community quizzes)

- **Create:** a member of a space posts a quiz from the materials page
  (`QuizBuilder` — up to 20 questions, 2–6 options each, optional explanation per
  question). Payload lives in `study_materials.metadata.questions` (validated by
  `src/lib/quizzes.ts`); the new `quiz` material type (migration 0008).
- **Take inline:** `QuizPlayer` (`/app/spaces/[slug]/materials/[id]`) — one
  question at a time, instant **server-authoritative grading** on submit
  (`gradeQuiz` in `src/lib/quizzes.ts`), then a per-question review showing your
  answer vs. the correct one plus explanations.
- **Leaderboard:** `QuizLeaderboard` — top 10 by best % (🥇🥈🥉), your own best
  highlighted; `quiz_attempts` keeps one row per user per quiz so the board stays
  lean on the free tier. New personal bests award +5 XP.
- **Review queue:** on results, "Add to my review queue" builds a private-ish
  SM-2 flashcard deck from the missed questions (front = question, back = correct
  answer + explanation) — `createQuizReviewDeck` builds cards server-side from
  the quiz payload, is idempotent (a second call returns the existing deck,
  detected across reloads), and the deck flows through the normal flashcard
  review system.
- **Actions:** `src/actions/quizzes.ts`; **Files:** `quiz-builder.tsx`,
  `quiz-player.tsx`, `quiz-leaderboard.tsx`, `src/lib/quizzes.ts`.

## Save / bookmark collections

- **Save:** bookmark icons on thread pages and material cards (incl. quizzes)
  toggle `saved_items` — one row per user per item (`item_type` thread/material,
  migration 0012, user-owned RLS).
- **Folders:** `/app/saved` groups items into named folders (create via the
  New folder form) plus an Uncategorized group; a per-item select moves items
  between folders, and deleting a folder keeps its items (FK set-null).
- **Actions:** `src/actions/saved.ts` (toggle, create/delete folder, move);
  **Files:** `save-button.tsx`, `saved-item-actions.tsx`; graceful until the
  migration is applied (page shows a setup notice, buttons toast errors).

## Community home feed

- **Route:** `/app/feed` (nav: desktop + mobile).
- A combined, chronological timeline of **discussions + study materials** from
  your communities (spaces you've joined plus every public space), with
  All / Discussions / Materials filter chips.
- Thread cards show score; material cards get a type icon (File/Link/Note/
  Flashcards/Quiz) and link to the detail page for flashcards, quizzes, and
  files (PDF preview / lightbox), or the materials list otherwise. Server page
  (`src/app/app/feed/page.tsx`) fetches via RLS-scoped queries; the merge,
  sort, and filter live in `src/components/community/community-feed.tsx`.

## Meetings & live calls

- **Routes:** `/app/meetings`, `/app/meetings/new`, `/app/meetings/[id]`.
- Scheduled calls with RSVP (going/maybe/decline), auto-generated **Jitsi**
  `call_url`, embedded **Live Call Room** (HD video/audio/screen-share iframe,
  fullscreen, start/end controls, organizer-only status changes), LIVE badges,
  AI-generated reminders (Groq or plain-text fallback) delivered by
  `meeting-reminder-notifier.tsx`.
- **Actions:** `src/actions/meetings.ts`.

## Moderation hardening (AI + educational coverage)

- **Every learner-generated surface is AI-checked at creation** — threads,
  replies (incl. nested), study notes, link materials, flashcard decks, quiz
  questions/options, file upload titles, announcements, and meeting titles.
  High-risk content is rejected with a clear message (notes/links/decks/upload
  errors surface on the materials page banner).
- The AI prompt now flags **promotional/advertising content** and explicitly
  requires content to stay **educational and on-topic** (in addition to
  profanity/hate/violence/spam). Room chat runs fast local checks on the send
  path, then AI-reviews messages **in batches** (one Groq request per 15) via
  `/api/moderation/chat` — flagged messages are hidden and logged without any
  per-message latency.
- See [docs/MODERATION.md](../docs/MODERATION.md) for the full coverage table.

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
    (`study_room_message_reactions`, realtime); instant local profanity check on
    send, then **batched AI moderation** hides non-educational/promotional
    messages after the fact (removal placeholder in the feed).
  - **Focus timer** — 25/5 pomodoro synced by broadcast (`endsAt`-based so
    everyone counts down together; pause/resume/skip/reset; auto focus→break;
    localStorage persistence).
  - **Presence avatars**, **one-click Jitsi video call**, **copy invite link**,
    host **End room** (read-only board + disabled chat afterwards).
- **Actions:** `src/actions/study-rooms.ts`; **Files:**
  `src/components/study-rooms/*`, `src/lib/study-room-utils.ts`.
- **Entry points:** desktop + mobile nav, dashboard quick actions, space pages
  (`/app/study-rooms?space=…` preselects the space).

## Community leaderboard

- **Route:** `/app/spaces/[slug]/leaderboard` (linked from the space header,
  visible to any reader of the community — like a subreddit sidebar).
- Ranks the community's members by **XP** (with level + streak from
  `user_stats`) or **contributions** (threads + materials + replies within that
  community), with 🥇🥈🥉 medals, moderator badges, and the caller highlighted.
  Server page aggregates `space_members` + `user_stats` + per-author counts;
  sorting lives in `src/components/community/community-leaderboard.tsx`.

## Mod dashboard + automod

- **Route:** `/app/spaces/[slug]/moderation` (space mods + app mods; linked from
  the space header).
- **Automod rules:** mod-defined keyword rules (`spaces.automod_rules` jsonb,
  migration 0014) — each has a name, comma-separated case-insensitive keywords,
  a scope (threads / replies / both), and an action: **flag** (hide + log) or
  **remove** (block outright). Enforced in `createThread` / `createPost` via the
  pure `checkAutomod` helper (`src/lib/automod.ts`, unit-tested); flagged
  content is logged to `moderation_actions` with `space_id`.
- **Mod action history:** the community's log (automod + AI flags + manual mod
  actions) with actor, action badge, and note. Migration 0014 also fixes two
  latent issues: space mods couldn't read the log (new select policy), and
  `auto_flag` inserts by non-app-mods silently failed (relaxed insert policy).
- **Fix:** thread creation from the community page passed the *slug* as
  `space_id` (uuid FK) — `createThread` now resolves the space id via
  `id.eq OR slug.eq` before inserting.

## Weekly community digest

- Every **Monday 08:00 UTC** the `send_weekly_digests` RPC (called by the
  `/api/cron/digest` cron, guarded by `CRON_SECRET` like the push cron) inserts
  a `digest` notification for each user whose communities had activity in the
  past 7 days: "N new discussions · M new materials · K new replies across C
  communities" → links to `/app/feed`. At most one digest per rolling week; no
  activity → no digest (migration 0013).
- Digest notifications render with the 📬 icon in the bell + notifications page
  and flow through the existing push pipeline.

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
