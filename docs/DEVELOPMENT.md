# Development

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the four required vars
npm run dev                  # http://localhost:3000
```

Environment keys: see [Deployment](DEPLOYMENT.md#environment-variables).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (react/compiler + TS rules) |
| `npm test` | Vitest run (unit + component tests) |
| `npm run test:watch` | Watch mode |
| `npm run mobile:sync` | `next build && npx cap copy` (native web assets) |
| `npm run mobile:ios` / `mobile:android` | Open native IDE |
| `npm run mobile:gen-icons` | Regenerate app icons |
| `npm run mobile:android:apk` | Build release APK |
| `npm run desktop:start` | Run the Electron shell |
| `npm run desktop:build` | Build desktop binaries |

## Conventions

- **Next.js 16** — this version has breaking changes; check
  `node_modules/next/dist/docs/` before relying on an API. Use existing patterns
  (this repo is the best reference).
- **Server components first.** Pages are RSC; only interactive pieces are
  `"use client"` (forms, realtime, canvas, timers).
- **Mutations go through server actions** in `src/actions/*` (one file per
  feature area). Route handlers are reserved for form posts (auth) and
  webhooks/cron.
- **Supabase clients:** `src/lib/supabase/server.ts` (cookies) for RSC/actions;
  `client.ts` (browser) for realtime + uploads; `admin.ts` (service role) only
  where absolutely needed.
- **RLS is the security boundary** — server code never bypasses it casually.
- **Free-tier discipline:** keep high-frequency or personal data out of Postgres
  (localStorage + broadcast/presence); cap payloads; debounce DB writes
  (e.g. whiteboard snapshots).
- **Realtime:** `postgres_changes` for persisted lists, `presence` for who's
  here / cursors, `broadcast` for ephemeral events. Channels are UUID-scoped.
  New realtime tables must be added to the `supabase_realtime` publication.
- **Pure logic lives in `src/lib`** as testable functions (SRS, profanity,
  study-room utils, gamification math). New pure helpers → add unit tests.
- **UI:** shadcn/ui primitives in `src/components/ui`; `cn()` from
  `src/lib/utils.ts`. Icons from `lucide-react`.
- **React rules:** no ref writes during render, no `setState` inside effects
  without a reason, no `Date.now()` during render — ESLint enforces these.

## Testing

- Vitest + Testing Library + jsdom. Run `npm test`.
- Existing suites: `src/lib/__tests__/*` (pure logic), `src/lib/supabase/__tests__/*`
  (moderation), `src/components/**/__tests__/*` (component rendering).
- Write tests for new pure helpers; component tests for user-visible behavior
  (form validation, realtime list updates).

## Before you ship

```bash
npx tsc --noEmit    # typecheck (no emit)
npm run lint        # eslint
npm test            # vitest
npm run build       # production build
```

Then follow the deploy steps in [Deployment](DEPLOYMENT.md).

## Working on study rooms specifically

Key files:

```
src/app/app/study-rooms/page.tsx        hub (create form + open rooms)
src/app/app/study-rooms/[id]/page.tsx   room page (fetches room, messages,
                                        mention candidates, reactions)
src/components/study-rooms/study-room.tsx      shell (header, layout, tools)
src/components/study-rooms/whiteboard.tsx      canvas + strokes + cursors
src/components/study-rooms/room-chat.tsx       chat + @mentions + reactions
src/components/study-rooms/pomodoro-timer.tsx  broadcast-synced timer
src/components/study-rooms/room-presence.tsx   presence avatars
src/actions/study-rooms.ts             create/save/chat/mention/reaction actions
src/lib/study-room-utils.ts            pure helpers (caps, pomodoro, mentions)
supabase/migrations/20260812000004_study_rooms.sql
supabase/migrations/20260812000005_study_room_reactions.sql
```

**Schema-missing degradation:** pages and actions guard against missing tables
(`isSchemaMissingError` / `schema cache` checks) so the app never 500s before a
migration is applied. Keep new study-room code consistent with that.

## Documentation

Docs live in `docs/` (see `docs/README.md`). After meaningful changes, append a
dated entry to the Development Log at the top of `AGENTS.md`.
