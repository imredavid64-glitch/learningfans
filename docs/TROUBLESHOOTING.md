# Troubleshooting

## Build / deploy

### `500 MIDDLEWARE_INVOCATION_FAILED` on every page
Missing Supabase env vars in Vercel (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Set them and redeploy.

### `Error: Resource is limited - try again in 24 hours (api-deployments-free-per-day)`
Vercel Hobby caps deployments at **100/day**. Wait for the reset, then:
`npx vercel --prod --yes && npx vercel alias set <url> learningfans.vercel.app`.

### Alias doesn't stick
Auto-alias on `--prod` is unreliable. Always run the explicit `vercel alias set`.

### `next build` fails on a new API/route
Verify with the same commands CI would run: `npx tsc --noEmit`, `npm run lint`,
`npm test`, then `npm run build`.

## Supabase / database

### SQL editor shows `DEPRECATION NOTICE: GOTRUE_JWT_DEFAULT_GROUP_NAME ...`
**Harmless and unrelated to your SQL.** GoTrue (Supabase Auth) prints these for
legacy JWT-group config on every query in the editor. Nothing to configure; auth
and the app keep working.

### `type "profile_role" already exists` when pasting the initial migration
The schema is already applied (fully or partially). **Do not re-run it.** Run
`supabase/verify_schema.sql`; apply only the missing migrations from the index
in [Database](DATABASE.md#migrations-index).

### New feature shows "Study rooms aren't set up yet" banner
The `study_rooms` / `study_room_messages` migration hasn't been applied. Apply
`supabase/migrations/20260812000004_study_rooms.sql` (and `…0005` for reactions)
in the SQL editor, then reload.

### Room chat works but reactions do nothing
The reactions table is missing — apply `20260812000005_study_room_reactions.sql`.
Reactions no-op gracefully until then; chat + mentions still work.

### Realtime updates not arriving (chat, bell, thread posts)
- Confirm the table is in the `supabase_realtime` publication (see
  [Database](DATABASE.md#realtime-publication)).
- Confirm the browser can reach `wss://<project>.supabase.co` (CSP allows it).
- Check the browser console for channel subscription errors.

### Whiteboard strokes aren't persisting after refresh
The debounced `saveWhiteboard` writes a snapshot 2 s after the last stroke. If
the session expired mid-save it's skipped safely (next stroke re-saves). Also
confirm the snapshot is under the 600-stroke / 256 KB caps.

### `create_notification` RPC missing
The `20260811000000_study_progress_notifications.sql` migration hasn't been
applied. Room @mentions silently skip notifications until it is.

## Auth

### Confirmation email never arrives
Check Supabase Auth → Providers (Email enabled) and the redirect URLs
(`/auth/callback` for local + prod). Email providers can throttle in dev.

### "Invalid email format" / "Password must be at least 8 characters"
Client + server both validate; those exact messages come from `/api/login` and
`/api/signup`.

### Forgot password doesn't complete
The reset link routes through `/auth/callback?next=/reset-password` — that
redirect URL must be whitelisted in Supabase.

## Local development

### Dev server won't start on :3000
Another process owns the port (another agent's dev server is common in shared
checkouts). Run on another port: `PORT=3001 npx next dev -p 3001`.

### Dev server dies between tool calls (sandboxed environments)
Background dev servers may not survive between shell invocations. Restart when
needed; rely on `npm run build` for compile verification.

### Lint errors about refs/setState
The repo uses aggressive react rules. Fix patterns: no ref writes during render,
no `setState` directly in effects, no `Date.now()` during render (see
[Development](DEVELOPMENT.md#conventions)).

## Free-tier capacity

### Database nearing 500 MB
Enable archival: set `ARCHIVE_SUPABASE_URL` / `ARCHIVE_SUPABASE_SERVICE_KEY`;
`src/lib/archive.ts` moves old data when `get_db_size` crosses the threshold.
Also keep payload caps in mind (decks ~150 KB, whiteboards 256 KB).

### Storage quota errors on upload
Per-user 25 MB / per-file 5 MB limits. `storage_used_bytes` on profiles tracks
usage; images are compressed to save space.

## Native apps

### Haptics don't vibrate on iOS/Android
Requires `npx cap sync` + native rebuild after adding `@capacitor/haptics`. Code
no-ops on web, so everything stays safe pre-sync.

### "Unknown sources" / Gatekeeper / SmartScreen warnings on installs
Expected: the APK is debug-signed and desktop builds are unsigned/not notarized.

### OS push notifications not arriving on mobile
Not implemented: OS push needs Firebase (FCM) + APNs service accounts, the
push-notifications plugin, and a native rebuild. Web push (VAPID) works instead.
