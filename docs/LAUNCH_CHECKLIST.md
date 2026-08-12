# LearningFans — Launch Checklist

Runbook for the launch team. Work top to bottom; every box should be ticked before
public launch. Companion docs: [README](../README.md) (setup/deploy),
[ROADMAP.md](ROADMAP.md) (next features), [`supabase/verify_schema.sql`](../supabase/verify_schema.sql)
(schema status).

---

## 0. Pre-flight (one-time setup, do at least a week before launch)

### Infrastructure
- [ ] Supabase project `xhximqrchwwwwwsysgdo` reachable; **Email auth** provider enabled
- [ ] Auth redirect URLs configured in Supabase (Authentication → URL Configuration):
  - Site URL: `https://learningfans.vercel.app`
  - Redirect URL: `https://learningfans.vercel.app/auth/callback`
- [ ] Schema applied end-to-end — run [`supabase/verify_schema.sql`](../supabase/verify_schema.sql)
  in the SQL editor; **all 16 tables show `exists = true`** (includes `study_rooms`,
  `study_room_messages`, `push_subscriptions`, `notifications`, `user_stats`, …)
- [ ] Missing feature migrations applied manually (see README table):
  `20260812000001…0004`, `20260811000000`, `20260807000000`, `20260728000000`
- [ ] First admin promoted: `update public.profiles set role = 'admin' where display_name = '<name>';`

### Vercel environment variables
- [ ] Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`
- [ ] Optional (features degrade without them): `GROQ_API_KEY`, `GEMINI_API_KEY`,
      `SUPABASE_ACCESS_TOKEN`, `ARCHIVE_SUPABASE_URL`, `ARCHIVE_SUPABASE_SERVICE_KEY`,
      `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, `CRON_SECRET`
- [ ] Deployment aliased: `https://learningfans.vercel.app` → latest production deployment
      (run `npx vercel alias set <deployment-url> learningfans.vercel.app` after every deploy)
- [ ] Cron check: `vercel.json` schedules `GET /api/push/send` at `0 8 * * *` — confirm one
      successful run in Vercel → Cron logs after launch day

### Communications & monitoring
- [ ] Vercel team has access to project logs (Deployment → Functions → Logs)
- [ ] Supabase dashboard monitored: database size, storage, egress vs. Free-tier caps
      (500 MB DB / 1 GB storage / 5 GB egress / 50k MAU)
- [ ] Designate launch owner + on-call; agree on rollback = "Redeploy previous deployment"

---

## 1. Gate — must pass before launch

- [ ] `npm test` → **86/86 passing**
- [ ] `npx tsc --noEmit` → clean
- [ ] `npm run lint` → clean
- [ ] `npm run build` → compiles, no route errors
- [ ] `https://learningfans.vercel.app` loads (HTTP 200) and `/login` renders
- [ ] Unauthenticated `/app/*` redirects to login (307 with `?redirect=`)

---

## 2. Signup → first study room (primary journey)

Use a **fresh email** (e.g. `launch-qa-<date>@example.com`) and a **second test account**
for cross-account checks.

- [ ] **Sign up** at `/signup` → confirmation email arrives → click through → lands in `/app`
- [ ] Invalid email format and <8-char password are rejected client+server side
- [ ] **Sign in** at `/login` with the confirmed account
- [ ] Dashboard loads: Welcome, Study Stats card, "Study together" quick actions,
      Deadline Radar, spaces/priorities/upcoming cards
- [ ] **Forgot password** flow works (`/forgot-password` → email → `/reset-password`)
- [ ] Create a **space** (Spaces → Create a space); join it from the second account
- [ ] Open **Study Rooms** from the nav (desktop) and mobile bottom nav
- [ ] **Create a study room** (optionally linked to the space) → lands on the room page
- [ ] Room shows: Live badge, host name, presence avatars ("1 person in the room"),
      whiteboard, chat, focus timer, Copy invite, Video call, End room (host only)

## 3. Study room deep QA (two accounts, two tabs/browsers)

### Whiteboard — the critical path
- [ ] Draw in tab A → stroke appears live in tab B (within ~1s)
- [ ] Different pen colors + widths render correctly on both sides
- [ ] Eraser removes ink on both sides; undo removes the last stroke everywhere
- [ ] Clear board (with confirm) empties both sides
- [ ] **Refresh tab B** → the full board redraws from the saved snapshot
- [ ] Wait ~3s after a stroke, refresh both tabs → board persists (debounced save fired)
- [ ] Two people draw at once without either board corrupting
- [ ] Single tap renders a dot (no dead taps)

### Chat
- [ ] Message from A appears live in B with correct author + timestamp
- [ ] Own messages render right-aligned; incoming left-aligned
- [ ] Refresh → last ~100 messages reload from the DB
- [ ] Profanity is filtered (try a blocked word → flagged, not posted)
- [ ] Empty message can't be sent; 500-char cap enforced

### Mentions
- [ ] Typing `@` in the composer shows an autocomplete list of space members
- [ ] Picking a name inserts `@Display Name` and sends a mention
- [ ] The mentioned user sees the **bell ping** (👋) with the message preview
- [ ] Clicking the notification opens the exact study room
- [ ] Mentioning yourself or a non-member does **not** create a notification

### Reactions
- [ ] Reacting to a message shows the chip live in the other tab
- [ ] Clicking your own chip removes the reaction (count decrements live)
- [ ] Toggling off the reactions table migration shows the chat still works

### Focus timer
- [ ] Start in A → countdown syncs in B (same remaining time, both ticking)
- [ ] Pause in A → B pauses too; Resume continues from the frozen time (not full restart)
- [ ] Skip toggles focus ⇄ break; Reset returns to idle 25:00
- [ ] Refresh B mid-run → countdown continues (localStorage) and re-syncs on next event
- [ ] Timer reaching 0 auto-transitions focus → break (beep + haptic on native)

### Presence, calls, invites
- [ ] Avatar count + names update as accounts join/leave (live presence)
- [ ] Copy invite → paste in a second browser → link opens the same room
- [ ] Video call opens the room's Jitsi page in a new tab
- [ ] Host "End room" → everyone sees read-only board + disabled chat; hub no longer lists it

## 4. Regression sweep (existing features still healthy)

- [ ] Create thread + reply in a space (realtime post appears without refresh)
- [ ] Upload a file, add a link, a note, and a flashcard set (5 MB / 25 MB caps enforced)
- [ ] Review flashcards: SM-2 grading, mastered tracking, offline deck download
- [ ] Set material priority → visible on `/app/priorities` + Deadline Radar
- [ ] Create a personal and a space schedule event; RSVP to a meeting
- [ ] Live call room (Jitsi) opens from a scheduled meeting
- [ ] Global search finds a space, thread, material, and a person
- [ ] Daily check-in + streak: XP increases; leaderboard updates
- [ ] Notification bell shows new material/thread/meeting/reply events
- [ ] Web push: subscribe in Settings, confirm daily cron delivered at least one push

## 5. Security & moderation spot checks

- [ ] A non-member cannot view a private space's contents (RLS)
- [ ] A non-creator cannot end someone else's study room (RLS blocks → error toast)
- [ ] A suspended user cannot post (chat, threads, materials) — `is_suspended()` enforced
- [ ] Mod queue (`/app/mod`) resolves a report; hidden content disappears for normal users
- [ ] Profanity escalation: repeated violations raise a warning → restriction on the profile
- [ ] No `.env.local` / API keys in the repo or deployment logs (secret scan clean)

## 6. Native & PWA

- [ ] PWA: install prompt works; offline shell loads `/app/offline` without network
- [ ] Capacitor iOS/Android builds load the live site and render native styling
      (requires `npx cap sync` on a machine with Xcode/Android SDK — see `npm run mobile:*`)
- [ ] Electron desktop app opens and signs in (see `desktop/`)
- [ ] Binaries: `git tag v<version>`, run `.github/workflows/build-binaries.yml`
      (workflow_dispatch, tag input), confirm assets on GitHub Releases → `/download` page links resolve

## 7. Post-launch (first 24–72 hours)

- [ ] Monitor Vercel function errors + Supabase DB size/egress daily
- [ ] Watch auth: signup conversion, failed logins, email provider errors
- [ ] Confirm push cron fires (Vercel Cron logs)
- [ ] Collect feedback → triage into `docs/ROADMAP.md` (marked as brainstormed, not promised)
- [ ] Archive rotation ready: if DB nears 500 MB, `archive.ts` + `ARCHIVE_SUPABASE_*` kick in —
      verify an archival run succeeds once
