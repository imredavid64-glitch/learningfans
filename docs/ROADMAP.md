# LearningFans — Feature Brainstorm & Roadmap

Living document. Everything below is a candidate, not a promise. Ideas are tagged
by effort (`S` = small, `M` = medium, `L` = large) and impact (`🔥` = high).

> Last updated: 2026-08-12 — right after **Interactive Study Rooms** shipped
> (live whiteboard, room chat, shared pomodoro, presence, one-click video call).

---

## 1. Make communication even easier

- **@mentions + notifications in rooms** (`S`): typing `@name` in room chat pings that
  user with a notification (we already have the bell + `create_notification` RPC).
  Parse mentions in `sendRoomMessage` and fire per-user notifications.
- **Presence cursors on the whiteboard** (`M`): show a small colored dot with each
  person's name where their pointer is right now (realtime `presence` broadcast of
  `{x, y}` throttled to ~10 Hz). Makes collaboration feel alive.
- **Threaded replies in room chat** (`M`): hover a message → "reply", replies nest
  under it. Chat gets long in live rooms; threading keeps it scannable.
- **Reactions on messages** (`S`): 👍 / 🚀 / 🔥 emoji picker per message, stored as
  `jsonb` on `study_room_messages`. Cheap, fun, very sticky.
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

- **2026-08-12** — Interactive Study Rooms (this feature set): join live rooms,
  shared realtime whiteboard (pen/eraser/undo/clear, broadcast + debounced
  snapshot), persisted room chat (RLS + postgres_changes realtime), shared pomodoro
  focus timer (broadcast-synced, survives refresh via localStorage), live presence
  avatars, one-click Jitsi video call, invite links. Hub at `/app/study-rooms`,
  rooms at `/app/study-rooms/[id]`, entry points in nav + dashboard + space pages.
- **2026-08-11** — Study streaks + XP, notification bell, live study-room presence on
  flashcards.
- **2026-08-06** — Live calls (Jitsi) + visual schedule calendar.
