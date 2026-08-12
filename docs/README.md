# LearningFans — Documentation

LearningFans is a student study community app: discuss in spaces, share study
materials (files, links, notes, flashcards), prioritize what to study, manage
personal + shared schedules, and collaborate in **live study rooms** (shared
whiteboard, room chat with @mentions + reactions, focus timer, presence cursors,
one-click video calls) — with moderation tools. Built for the **Supabase Free**
tier and deployed on **Vercel**.

- **Production:** https://learningfans.vercel.app
- **Supabase project:** `xhximqrchwwwwwsysgdo`
- **Source:** https://github.com/imredavid64-glitch/learningfans

## Guides

| Doc | What it covers |
|-----|----------------|
| [Architecture](ARCHITECTURE.md) | Stack, runtime model (App Router / RSC / server actions / middleware), realtime architecture, data flow |
| [Database](DATABASE.md) | Every table, RLS model, RPC functions, realtime publications, migrations |
| [Features](FEATURES.md) | Every feature area: routes, server actions, components, gotchas |
| [Deployment](DEPLOYMENT.md) | Vercel deploy + aliasing, environment variables, cron, native apps, PWA, binary releases |
| [Development](DEVELOPMENT.md) | Local setup, scripts, conventions, testing, linting |
| [Moderation & trust & safety](MODERATION.md) | Profanity pipeline, escalation, reports, sanctions, RLS security model |
| [Troubleshooting](TROUBLESHOOTING.md) | Common failures and how to fix them |
| [Launch checklist](LAUNCH_CHECKLIST.md) | Pre-flight → QA → post-launch runbook |
| [Roadmap / brainstorm](ROADMAP.md) | Living feature ideas, tagged by effort & impact |
| [Supabase setup](SUPABASE_SETUP.md) | One-time Supabase project configuration |

## Quick facts

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
  shadcn/ui · Supabase (Auth, Postgres + RLS, Storage, Realtime) · Vercel ·
  Capacitor 8 (iOS/Android) · Electron · PWA.
- **Auth:** Supabase email auth; cookie-based sessions via `@supabase/ssr`;
  login/signup are route handlers at `/api/login` and `/api/signup`; forgot /
  reset password at `/forgot-password` → `/reset-password`.
- **Free-tier guardrails:** metadata-only in Postgres (no file blobs), 25 MB /
  user storage, 5 MB / file, image compression, signed download URLs,
  pagination, archival to a second Supabase project when the DB nears its limit,
  local-first data (spaced repetition progress, offline decks, pomodoro state)
  kept out of the DB.
- **Roles:** `student` → `moderator` → `admin` (column on `public.profiles`).
  There is **no admin password**; promote via SQL (see README).
- **Realtime:** `postgres_changes` (live lists), `presence` (who's here,
  whiteboard cursors), `broadcast` (whiteboard strokes, pomodoro events).

## Repo map

```
src/app/            Routes (marketing, auth, /app/*)
src/actions/        Server actions (one file per feature area)
src/components/     UI + feature components (layout, materials, study-rooms, …)
src/components/ui/  shadcn/ui primitives
src/lib/            Supabase clients, auth helpers, constants, pure logic
src/lib/supabase/   server + browser + admin clients
src/proxy.ts        Middleware: session refresh + security headers
supabase/migrations/  Schema, applied in filename order (combined.sql = one-shot)
docs/               This documentation
desktop/            Electron shell
ios/ android/       Capacitor shells
.github/workflows/  Binary release builds
```

## Roles in the app

| Role | Access |
|------|--------|
| `student` | Spaces, discussion, materials, schedule, study rooms |
| `moderator` | + Mod queue, sanctions, hide content, end rooms |
| `admin` | + User roles, storage overview, school provisioning |

## Index of `/app` routes

`/app` (dashboard) · `/app/spaces` · `/app/spaces/[slug]` (+ `materials`,
`materials/[id]`, `threads/[id]`) · `/app/study-rooms` · `/app/study-rooms/[id]` ·
`/app/meetings` · `/app/meetings/new` · `/app/meetings/[id]` · `/app/schedule` ·
`/app/priorities` · `/app/search` · `/app/notifications` · `/app/offline` ·
`/app/settings` · `/app/profile` · `/app/grades` · `/app/enrollments` ·
`/app/study-hub` · `/app/classes/[slug]/…` · `/app/mod` · `/app/admin`

Public routes: `/` (marketing) · `/login` · `/signup` · `/forgot-password` ·
`/reset-password` · `/demo` · `/download` · `/auth/callback` · `/api/*`
