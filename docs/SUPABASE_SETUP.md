# Supabase setup for LearningFans

- **Project URL:** `https://xhximqrchwwwwwsysgdo.supabase.co`
- **Production app:** `https://learningfans.vercel.app`

## 1. Environment

**Local** — `.env.local` (not committed):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xhximqrchwwwwwsysgdo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Vercel** — same keys, but:

```env
NEXT_PUBLIC_APP_URL=https://learningfans.vercel.app
```

## 2. Database schema

### First time only

Paste [`supabase/migrations/20260520100000_initial_schema.sql`](../supabase/migrations/20260520100000_initial_schema.sql) in the [SQL Editor](https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/sql/new) and run once.

### Error: `type "profile_role" already exists`

**You already applied the schema.** Do not run the full migration again.

1. Run [`supabase/verify_schema.sql`](../supabase/verify_schema.sql)
2. If `profiles`, `spaces`, `study_materials`, `schedule_events` all show `true`, you are done
3. Optionally run [`supabase/migrations/20260528100000_profile_insert_policy_only.sql`](../supabase/migrations/20260528100000_profile_insert_policy_only.sql)

### Fresh reset (destructive — deletes all app data)

Only if you want to start over:

```sql
drop schema public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;
```

Then run `initial_schema.sql` once.

## 3. Auth redirect URLs

[Auth → URL Configuration](https://supabase.com/dashboard/project/xhximqrchwwwwwsysgdo/auth/url-configuration)

| Type | URL |
|------|-----|
| Site URL | `https://learningfans.vercel.app` |
| Redirect URLs | `https://learningfans.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

## 4. First admin

```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

## 5. Run locally

```bash
npm install
npm run dev
```
