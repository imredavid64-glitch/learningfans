# LearningFans

A student study community app: discuss in spaces, share study materials (files, links, notes, flashcards), prioritize what to study, and manage personal + shared schedules — with moderation tools. **Interactive study rooms** let people join live rooms with a shared realtime whiteboard, room chat, a synced focus timer and one-click video calls. Built for the **Supabase Free** tier and deployed on **Vercel**.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind + shadcn/ui
- **Supabase** — Auth, Postgres (RLS), Storage, Realtime
- **Vercel** — hosting
- **GitHub** — source control

## Free tier limits (built-in guardrails)

| Limit | App behavior |
|-------|----------------|
| 500 MB database | Metadata only; no file blobs in Postgres |
| 1 GB file storage | 25 MB per user, 5 MB per file, image compression |
| 5 GB egress | Pagination, signed download URLs |
| 50k MAU | No special v1 constraint |

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Enable **Email** auth (Authentication → Providers).
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://learningfans.vercel.app/auth/callback`
4. Apply migrations:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or, for a fresh install, paste the whole thing as one script:
[`supabase/migrations/combined.sql`](supabase/migrations/combined.sql) (all 14 migrations
concatenated in order — includes meetings, notifications, push, study rooms, etc.).

5. Copy API keys from **Project Settings → API**.

### 2. Local env

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. First admin

After signup, in Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

## Deploy (Vercel + GitHub)

1. Push this repo to GitHub. **Keep `.gitignore`** — never commit `.env.local` or API keys.
2. Import the repo in [Vercel](https://vercel.com).
3. **Required environment variables** (Vercel → Project → Settings → Environment Variables):

| Variable | Example | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Project URL only — **no** `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` or anon key | Safe for browser |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | Server only — **not** `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | `https://learningfans.vercel.app` | Production site URL |

Missing Supabase vars cause **`500 MIDDLEWARE_INVOCATION_FAILED`** on every page.

Optional server-only keys (features degrade gracefully when absent):

| Variable | Notes |
|----------|-------|
| `GROQ_API_KEY` | AI content moderation + meeting reminders (falls back to local profanity filter / plain-text reminders) |
| `GEMINI_API_KEY` | AI security reports for school admins |
| `SUPABASE_ACCESS_TOKEN` | School provisioning via the Supabase management API |
| `ARCHIVE_SUPABASE_URL` / `ARCHIVE_SUPABASE_SERVICE_KEY` | Archival to a second Supabase project when the DB nears its limit |
| `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push notifications (generate with `npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | Protects the `/api/push/send` cron endpoint — Vercel sends it as `Authorization: Bearer` on cron requests (any random string) |

4. Redeploy after saving env vars (Deployments → … → Redeploy).
5. In Supabase → Authentication → URL Configuration, add:
   - Site URL: `https://learningfans.vercel.app`
   - Redirect URL: `https://learningfans.vercel.app/auth/callback`

### SQL: "type profile_role already exists"

That means the migration **already ran** (fully or partly). **Do not paste the full `initial_schema.sql` again.**

Run [`supabase/verify_schema.sql`](supabase/verify_schema.sql) instead. If all tables show `exists = true`, you are done.

Only run [`supabase/migrations/20260528100000_profile_insert_policy_only.sql`](supabase/migrations/20260528100000_profile_insert_policy_only.sql) if you need the extra profile insert policy.

Optional: install the [Supabase Vercel integration](https://vercel.com/integrations/supabase) to sync env vars.

### Existing projects: newer feature migrations

If you set the project up before a feature shipped, apply only the missing migration
files (each is standalone; `verify_schema.sql` tells you which tables exist):

| Feature | Migration |
|---------|-----------|
| Study rooms (whiteboard, chat) | `20260812000004_study_rooms.sql` |
| Push subscriptions (web push) | `20260812000003_push_subscriptions.sql` |
| Schedule event reminders | `20260812000002_schedule_event_reminders.sql` |
| Reply notifications | `20260812000001_reply_notifications.sql` |
| Streaks/XP + notification bell | `20260811000000_study_progress_notifications.sql` |
| Profanity escalation | `20260807000000_profanity_escalation.sql` |

## Smoke test checklist

- [ ] Sign up / sign in
- [ ] Create a public space
- [ ] Join a space from another account
- [ ] Create thread and reply (realtime on thread page)
- [ ] Create a study room from `/app/study-rooms`; join it from a second account
- [ ] Draw on the whiteboard in one tab and see strokes appear in the other
- [ ] Send room chat messages (appear live via realtime)
- [ ] Start the shared pomodoro; see the countdown sync across tabs
- [ ] Upload a file, add link, note, flashcards
- [ ] Set material priority; view `/app/priorities`
- [ ] Create personal and shared schedule events
- [ ] Submit a report; resolve as moderator
- [ ] Admin: view users and storage

## Project structure

```
src/app/           # Routes (marketing, auth, /app/*)
src/actions/       # Server Actions
src/components/    # UI + feature components
src/lib/           # Supabase clients, auth, constants
supabase/migrations/
```

## Roles

| Role | Access |
|------|--------|
| `student` | Spaces, discussion, materials, schedule, study rooms |
| `moderator` | + Mod queue, sanctions, hide content |
| `admin` | + User roles, storage overview |

## Feature brainstorm

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the living feature brainstorm (communication, streamlining, study tools, gamification, native, trust & safety).
