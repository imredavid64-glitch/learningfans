# LearningFans

A student study community app: discuss in spaces, share study materials (files, links, notes, flashcards), prioritize what to study, and manage personal + shared schedules — with moderation tools. Built for the **Supabase Free** tier and deployed on **Vercel**.

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
   - `https://your-domain.vercel.app/auth/callback`
4. Apply migrations:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or paste [`supabase/migrations/20260520100000_initial_schema.sql`](supabase/migrations/20260520100000_initial_schema.sql) into the SQL editor.

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

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add the same env vars (use production URL for `NEXT_PUBLIC_APP_URL`).
4. Add the Vercel URL to Supabase auth redirect URLs.

Optional: install the [Supabase Vercel integration](https://vercel.com/integrations/supabase) to sync env vars.

## Smoke test checklist

- [ ] Sign up / sign in
- [ ] Create a public space
- [ ] Join a space from another account
- [ ] Create thread and reply (realtime on thread page)
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
| `student` | Spaces, discussion, materials, schedule |
| `moderator` | + Mod queue, sanctions, hide content |
| `admin` | + User roles, storage overview |
