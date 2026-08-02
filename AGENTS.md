<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Development Log

Append a dated entry after every meaningful change. Keep each entry short (what changed, files touched, anything broken/blocked). Newest at top.

## 2026-07-31 — Forgot/reset password flow
- Added password recovery: `/forgot-password` (requests reset email) and `/reset-password` (client component, reads recovery tokens from the URL fragment and calls `updateUser({ password })`).
- New API route `src/app/api/forgot-password/route.ts` (rate-limited, uses `resetPasswordForEmail` with `redirectTo = getAppUrl()/reset-password`).
- Added "Forgot?" link inside the password input on the login form (`src/components/auth/auth-form.tsx`).
- Recovery email routes through the **already-whitelisted** `/auth/callback?next=/reset-password` (no new Supabase Redirect URL needed — the callback exchanges the recovery code and continues to `/reset-password`).

## 2026-07-31 — Downloadable apps for all platforms
- App binaries are built with GitHub Actions (`.github/workflows/build-binaries.yml`, runs on `workflow_dispatch` with a `tag` input) and hosted on GitHub Releases at `github.com/imredavid64-glitch/learningfans`.
- Release tag `v0.1.0` holds: macOS DMG (arm64), Windows NSIS EXE, Linux AppImage + deb, Android APK.
- `/download` page's platform cards link straight to the GitHub release assets. The APK is debug-signed (play-install warns "unknown sources"); desktop builds are unsigned/not notarized → macOS Gatekeeper/Windows SmartScreen show warnings.
- To rebuild for a new version: bump version, `git tag`, run the workflow with the new tag.

## 2026-07-31 — GitHub repo + security
- Created public repo `imredavid64-glitch/learningfans`; pushed code.
- Scubbed two real-looking Supabase placeholder keys (`sb_publishable_*`, `sb_secret_*`) out of git history (were blocking pushes via secret scanning).
- Study Hub keys moved out of `src/app/api/study-hub/route.ts` into env vars: `STUDY_HUB_PROJECT`, `STUDY_HUB_SERVICE_KEY` (in Vercel production + `.env.local`). `.env.example` has placeholders.

## 2026-07-31 — Deployment + app wrappers
- Production alias: `learningfans.vercel.app`. Every deploy must be followed by `npx vercel alias set <deployment-url> learningfans.vercel.app` (CLI is slow; use long timeouts). Auto-alias on `--prod` sometimes doesn't stick.
- PWA (manifest, service worker, icons), Capacitor iOS/Android projects, Electron desktop app (loads the remote site).
- Sign-in uses route handlers at `/api/login` and `/api/signup` (not the server actions in `src/actions/auth.ts`); form posts are plain HTML.

## Convention notes
- There is **no admin password**. Admin is the `role` column on `public.profiles`. First school provisioning promotes the first profile to admin (`src/lib/schools.ts`). To escalate a user yourself, in the Supabase SQL editor: `update public.profiles set role = 'admin' where display_name = '<name>'`. The `/app/admin` page is gated by `isAdmin(profile.role)`.
- Supabase project: `nnrdkdisjfudibvrggxb` URL used for Study Hub; the LearningFans project is `xhximqrchwwwwwsysgdo`.
