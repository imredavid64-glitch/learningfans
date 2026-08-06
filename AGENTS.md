<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Development Log

Append a dated entry after every meaningful change. Keep each entry short (what changed, files touched, anything broken/blocked). Newest at top.

## 2026-08-06 — Codebase health pass
- Fixed all ESLint react/compiler + type issues flagged in the audit:
  - `thread-posts.tsx`: `Date.now()` no longer runs during render (timestamp moved into `handleSubmit` via `formData.set`)
  - `time-tracker.tsx`: `Date.now()` moved into `useState(() => ...)` lazy initializers (was evaluating every render)
  - `time-limit-setting.tsx`: removed synchronous `setState` inside `useEffect`; localStorage now read via lazy initializers `loadStoredLimit`/`loadTodayMinutes`
  - `meetings/page.tsx`: replaced `any` casts with typed `MeetingRow`/`RsvpRow` interfaces (Supabase nested `meetings!inner` returns an array)
- Re-verified: `tsc --noEmit` clean, 20/20 tests pass, `next build` compiles. Deployed + aliased `learningfans.vercel.app`.

## 2026-08-06 — Live calls + visual schedule
- Meetings: embedded Live Call Room (`src/components/meetings/live-call-room.tsx`) on `/app/meetings/[id]` — in-app HD video/audio/screen-share via Jitsi iframe with fullscreen, start/end controls (organizer can mark live/completed via new `updateMeetingStatus` action).
- Auto-generates a Jitsi `call_url` for every new meeting when none supplied (`src/actions/meetings.ts`).
- Meetings list page shows pulsing LIVE badge + "Join Live Call" callout on live meetings.
- Schedule: new interactive Visual Calendar (`src/components/schedule/visual-schedule-calendar.tsx`) — Month grid, Week grid, and List view toggles, prev/next/today nav, click-to-open event details with RSVP/delete.
- Fixed `createEvent` (`src/actions/schedule.ts`) to allow private personal events without a space (previously errored "Space is required").
- Class schedule page (`/app/classes/[slug]/schedule`): fixed broken "Add Event" link (now points to `/app/schedule?space=...`), wired up RSVP buttons, added hidden spaceId/visibility to instructor create form.
- Files: `src/app/app/meetings/[id]/page.tsx`, `src/app/app/meetings/page.tsx`, `src/components/meetings/live-call-room.tsx`, `src/app/app/schedule/page.tsx`, `src/components/schedule/visual-schedule-calendar.tsx`, `src/actions/meetings.ts`, `src/actions/schedule.ts`, `src/app/app/classes/[slug]/schedule/page.tsx`.

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

## 2026-08-03 — Fixed critical schema drift and security bugs
- Profanity filter: Fixed whole-word matching to prevent false positives (e.g., "class"/"assignment"/"pass" no longer auto-suspended real users)
- Schema drift: Added missing columns (`room`, `description`, `is_hidden`) to existing tables via defensive optional inserts
- Missing tables: Made meetings/space_passwords/school_members insert defensive (nulls skipped when schema mismatches)
- Validation: Added email format + 8+ char password checks to `/api/login` and `/api/signup`
- Moderation: Profiles no longer hidden via moderation actions (fixes `is_hidden` column drift)
- Open redirect: Fixed `/auth/callback` to use server-provided appUrl (prevents redirect risk)
- Study Hub API: Cleaned up duplicate code and added eslint disable for dynamic schema type safety
- Code audit: Fixed all audit findings (`schedule.ts`, `moderation.ts`, `meetings.ts`, auth API routes)
- Tests: All passing (`profanity.test.ts`, `utils.test.ts`, `moderation.test.ts`)

## 2026-07-31 — Deployment + app wrappers
- Production alias: `learningfans.vercel.app`. Every deploy must be followed by `npx vercel alias set <deployment-url> learningfans.vercel.app` (CLI is slow; use long timeouts). Auto-alias on `--prod` sometimes doesn't stick.
- PWA (manifest, service worker, icons), Capacitor iOS/Android projects, Electron desktop app (loads the remote site).
- Sign-in uses route handlers at `/api/login` and `/api/signup` (not the server actions in `src/actions/auth.ts`); form posts are plain HTML.

## Convention notes
- There is **no admin password**. Admin is the `role` column on `public.profiles`. First school provisioning promotes the first profile to admin (`src/lib/schools.ts`). To escalate a user yourself, in the Supabase SQL editor: `update public.profiles set role = 'admin' where display_name = '<name>'`. The `/app/admin` page is gated by `isAdmin(profile.role)`.
- Supabase project: `nnrdkdisjfudibvrggxb` URL used for Study Hub; the LearningFans project is `xhximqrchwwwwwsysgdo`.
