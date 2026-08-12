# Deployment

Production: **https://learningfans.vercel.app** (Vercel project `learningfans`,
org `imredavid64-glitchs-projects`). Git remote: `github.com/imredavid64-glitch/learningfans`.

## Environment variables

### Required (missing ones cause `500 MIDDLEWARE_INVOCATION_FAILED`)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` — no `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key, safe for browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only, **not** `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | `https://learningfans.vercel.app` in prod |

### Optional (features degrade gracefully when absent)

| Variable | Notes |
|----------|-------|
| `GROQ_API_KEY` | AI moderation + meeting reminders (falls back to local profanity filter / plain-text) |
| `GEMINI_API_KEY` | AI security reports for school admins |
| `SUPABASE_ACCESS_TOKEN` | School provisioning via the Supabase management API |
| `ARCHIVE_SUPABASE_URL` / `ARCHIVE_SUPABASE_SERVICE_KEY` | Archival to a second project near the DB cap |
| `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push (generate: `npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | Protects `/api/push/send` — name it **exactly** `CRON_SECRET` so Vercel adds `Authorization: Bearer` to cron requests |

## Deploying

```bash
# 1. Verify locally first
npm test && npx tsc --noEmit && npm run lint && npm run build

# 2. Deploy to production
npx vercel --prod --yes

# 3. Aliasing — auto-alias doesn't always stick; always set it explicitly
npx vercel alias set <deployment-url> learningfans.vercel.app
```

> **Free-tier daily cap:** Vercel Hobby limits deployments to **100/day**. When
> exhausted you get `api-deployments-free-per-day`; wait for the quota to reset
> (24h) before retrying.

### Post-deploy checklist

- `https://learningfans.vercel.app` returns 200.
- Unauthenticated `/app/*` redirects to `/login?redirect=…`.
- Supabase Auth URL config still lists `https://learningfans.vercel.app/auth/callback`.
- Any new migrations were applied in the SQL editor (see [Database](DATABASE.md)).
- Vercel → Cron logs show a successful `/api/push/send` run (daily 08:00 UTC).

## Cron

`vercel.json` schedules `GET /api/push/send` at `0 8 * * *` (one daily cron on the
Hobby plan). The endpoint is guarded by `CRON_SECRET` (Vercel's built-in cron
auth convention); if the secret or the `push_subscriptions` table is missing it
fails safe (401/503).

## Native apps

The app is **server-rendered**, so the native shells load the live site
(industry-standard). Offline capability is provided by the service worker shell
+ local storage.

### Capacitor (iOS/Android)

```bash
npm run mobile:sync            # next build && npx cap copy
npm run mobile:ios             # npx cap open ios
npm run mobile:android         # npx cap open android
npm run mobile:ios:build       # archive + export (macOS + Xcode required)
npm run mobile:android:apk     # ./gradlew assembleRelease
npm run mobile:gen-icons       # regenerate icons
```

- Haptics require `npx cap sync` + native rebuild (safe before then — they no-op).
- **OS push (FCM/APNs) is NOT wired** — it needs Firebase + APNs service
  accounts, the push-notifications plugin, and a native rebuild. Web push (VAPID)
  is fully working instead.

### Electron (desktop)

```bash
npm run desktop:start          # run the Electron shell (loads live site)
npm run desktop:build          # electron-builder for the current platform
```

### Binary releases (all platforms)

1. Bump the version in `package.json` (and `desktop/electron-builder.yml` uses it).
2. `git tag v<version>` and push the tag.
3. Run the **Build platform binaries** workflow
   (`.github/workflows/build-binaries.yml`) with `workflow_dispatch`, passing the
   tag. It uploads APK / Windows NSIS EXE / Linux AppImage+deb to that GitHub
   Release.
4. `/download` links resolve to the release assets.

> The APK is debug-signed (installers warn "unknown sources"); desktop builds are
> unsigned/not notarized (Gatekeeper/SmartScreen warnings).

## PWA

- `public/sw.js` (`learningfans-v2`) precaches `/`, `/login`, `/app/offline`,
  manifest + icons; network-first navigations with cache-then-shell fallback.
- Installable; web push via VAPID. Test: open the site, DevTools → Application →
  Service Workers → check it's active and push subscription works.

## Rollback

In Vercel → Deployments, find the last healthy deployment and **Redeploy** it
(no code changes needed). Remember to re-alias if the alias moved.
