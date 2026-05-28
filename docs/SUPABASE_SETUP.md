# Supabase setup for LearningFans

Project URL: `https://xhximqrchwwwwwsysgdo.supabase.co`

## 1. Environment (done locally)

`.env.local` is configured with your keys. **Do not commit** `.env.local`.

The Supabase URL must be the project root only — **not** `/rest/v1/`:

```
https://xhximqrchwwwwwsysgdo.supabase.co
```

## 2. Apply database schema (required once)

The API returned 404 for `profiles`, so migrations are not applied yet.

**Option A — SQL Editor (fastest)**

1. Open [SQL Editor](https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new)
2. Paste the full contents of [`supabase/migrations/20260520100000_initial_schema.sql`](../supabase/migrations/20260520100000_initial_schema.sql)
3. Run

**Option B — CLI**

```bash
supabase login
supabase link --project-ref xhximqrchwwwwwsysgdo
supabase db push
```

## 3. Auth redirect URLs

In [Auth → URL Configuration](https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/auth/url-configuration):

| Type | URL |
|------|-----|
| Site URL | `http://localhost:3000` (dev) |
| Redirect URLs | `http://localhost:3000/auth/callback` |
| | `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback` (after deploy) |

Enable **Email** provider under Authentication → Providers.

## 4. First admin

After you sign up in the app:

```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

Find your UUID in Authentication → Users.

## 5. Run the app

```bash
npm run dev
```

Visit http://localhost:3000

## 6. Vercel (production)

Add the same env vars in Vercel → Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` (secret key — **Production only**, never `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_APP_URL` = your Vercel URL

## Security note

If these keys were shared in chat or committed to git, rotate them in Supabase → Settings → API.
