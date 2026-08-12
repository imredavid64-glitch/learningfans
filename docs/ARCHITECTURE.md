# Architecture

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (`src/components/ui`) |
| Backend | Supabase — Auth, Postgres (RLS), Storage, Realtime |
| Hosting | Vercel (serverless functions + edge middleware) |
| Native | Capacitor 8 (iOS/Android), Electron (desktop), PWA (service worker) |
| Testing | Vitest + Testing Library (`npm test`) |
| Key libs | `@supabase/ssr`, `date-fns`, `lucide-react`, `sonner`, `zod`, `react-hook-form`, `web-push`, `sharp`, `@capacitor/haptics` |

## Runtime model

The app is **server-rendered Next.js** with a cookie-based Supabase session —
it is **not** a static export. This matters for the native apps: the Capacitor /
Electron shells load the live site (industry-standard for server-rendered apps);
offline capability comes from the service worker shell + local storage, not from
bundling the app.

### Request flow

```
Browser ──> proxy.ts (middleware)
              ├─ refreshes the Supabase session cookie (updateSession)
              └─ sets security headers (CSP, HSTS, nosniff, …)
   └─> Server Component (most /app pages)
         ├─ createClient()  → cookie-authenticated Supabase queries
         └─ renders RSC payload + client components
   └─> Server Actions (src/actions/*) for mutations
   └─> Route Handlers (/api/*) for form posts, webhooks, cron
   └─> Browser Supabase client (src/lib/supabase/client.ts) for realtime
```

### Auth

- **Email auth** via Supabase. Login/signup are plain-HTML form posts to
  `/api/login` and `/api/signup` (not server actions) with client+server
  validation (email format, 8+ char password).
- `/auth/callback` exchanges the code, then redirects to `?next=` (server-provided
  app URL — prevents open redirects).
- **Sessions are cookies** managed by `@supabase/ssr`:
  - `src/lib/supabase/server.ts` — server components / server actions / route handlers
  - `src/lib/supabase/client.ts` — browser (realtime, storage uploads)
  - `src/lib/supabase/admin.ts` — service-role client (profile upserts, archival)
- Guards: `getCurrentUser()` / `getCurrentProfile()` / `requireProfile()` in
  `src/lib/auth.ts`. `/app/*` redirects to `/login?redirect=…` when unauthenticated.
- There is **no admin password**. Role lives on `profiles.role`; promote with SQL.

### Security headers (proxy.ts)

`Content-Security-Policy` (self + supabase + groq), `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, and HSTS in
production. Server-action POSTs (`/_next/server-actions`) skip proxy processing.

## Realtime architecture

Three Realtime primitives are used. All channels are **UUID-scoped** (channel
names embed the resource id, making them effectively unguessable), matching the
RLS-gated reads.

| Primitive | Used for | Channel examples |
|-----------|----------|------------------|
| `postgres_changes` | Live lists that must survive refresh | `thread-{id}`, `room-chat-{roomId}`, `room-reactions-{roomId}`, `notification-bell` |
| `presence` | Who is in the room; whiteboard cursors; who's studying a deck | `study-room-{roomId}`, `study-room-board-{roomId}`, `study-room-{materialId}` (flashcards) |
| `broadcast` | Ephemeral, high-frequency collaboration | `study-room-board-{roomId}` (strokes/undo/clear), `study-room-pomodoro-{roomId}` |

Rules of thumb used across the app:

- **Anything that must survive a refresh** → persisted to Postgres + surfaced via
  `postgres_changes` (chat messages, reactions, notifications, thread posts).
- **High-frequency or ephemeral state** → `broadcast` or `presence`, never rows
  (whiteboard strokes stream live, snapshots debounce to the DB; pomodoro state
  is broadcast with `endsAt` so everyone computes the same countdown).
- **Presence over broadcast when disconnect cleanup matters** — presence entries
  auto-expire when a client disconnects (cursors, room membership).
- Real-time tables must be in the `supabase_realtime` publication
  (see [Database](DATABASE.md)).

### Study room realtime map

```
study-room-{roomId}            presence      avatars / "N people in the room"
study-room-board-{roomId}      presence      whiteboard cursors (throttled ~10 Hz)
                               broadcast     strokes, undo, clear
study-room-pomodoro-{roomId}   broadcast     start / pause / reset (endsAt-synced)
room-chat-{roomId}             postgres_changes  study_room_messages (INSERT)
room-reactions-{roomId}        postgres_changes  study_room_message_reactions (INSERT/DELETE)
```

## Data flow patterns

### Server actions (mutations)

1. Client form / event handler calls a `"use server"` action in `src/actions/*`.
2. Action does `requireProfile()`, validates, writes via the server client.
3. Optional `revalidatePath(...)` for cache invalidation; `redirect(...)` or an
   `ActionResult { redirect?, error? }` shape returns control to the client
   (`useActionState` forms redirect via `window.location.href`).
4. Live UIs update via realtime, not by refetching.

### Local-first data (free-tier discipline)

Heavy or personal data deliberately stays out of Postgres:

| Data | Storage | Notes |
|------|---------|-------|
| Spaced-repetition progress | `localStorage` (`lf-flashcard-progress`) | SM-2 in `src/lib/srs.ts` |
| Offline flashcard decks | `localStorage` (`lf-offline-decks`, ~3 MB cap) | oldest-eviction |
| Pomodoro state per room | `localStorage` (`lf-pomodoro-{roomId}`) | survives refresh |
| Whiteboard snapshots | `study_rooms.whiteboard` jsonb (600 strokes / 256 KB cap) | debounced save |
| File blobs | Supabase Storage (25 MB/user, 5 MB/file, compressed) | signed URLs only |

Only account-level data (XP via `award_xp`, messages, materials, …) touches rows.

## Free-tier guardrails

| Limit | Mitigation |
|-------|------------|
| 500 MB DB | Metadata only; local-first data; payload caps; archival (`src/lib/archive.ts`) to a second project via `ARCHIVE_SUPABASE_*` |
| 1 GB storage | 25 MB/user, 5 MB/file quotas, image compression, `storage_used_bytes` tracking |
| 5 GB egress | Pagination, signed download URLs |
| 50k MAU | No v1-specific mitigation |

## Directory map

```
src/proxy.ts           middleware (session + headers)
src/lib/supabase/      server / browser / admin clients
src/lib/auth.ts        guards, profile helpers, roles
src/actions/           server actions (auth, spaces, discussion, materials,
                       schedule, meetings, study-rooms, gamification,
                       notifications, moderation, search, classes, grades,
                       enrollments, schools, profile, admin)
src/components/        feature components + ui primitives
public/sw.js           PWA service worker (offline shell, web push)
vercel.json            cron schedule (GET /api/push/send @ 08:00 UTC)
```
