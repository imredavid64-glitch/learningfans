# Moderation & Trust & Safety

LearningFans ships a layered moderation pipeline. Content flows through it at
creation time, and moderators + admins have tooling to clean up after the fact.

## Layers (in order)

### 1. Local profanity filter (`src/lib/profanity.ts`)

- Word-list + leet-speak normalization (`0→o`, `3→e`, `$→s`, …) + inflections
  (`shitting`, `bitches`).
- **Whole-word matching on purpose** — `ass` inside `class`/`assignment`/`pass`
  must NOT match (historical false-positive bug; regression-tested).
- `containsProfanity(text)` → `{ clean, words }`.

### 2. Local spam heuristics (`containsSpam`)

Excessive caps, repeated characters, >3 URLs, repeated phrases.

### 3. AI moderation (`src/lib/supabase/server.ts`)

- `checkContentWithAI` — Groq (`llama3-8b-8192`) with a JSON-schema prompt
  (profanity, hate, violence, spam, inappropriate academic content, **and
  promotional/advertising content** — the prompt explicitly requires content to
  stay educational and on-topic). Falls back to "allow" on API errors, and the
  local checks run first so the AI isn't the gatekeeper.
- `checkProfanityWithEscalation(userId, content, contextType, contextId)` —
  the local profanity/escalation pipeline used by posts, threads, materials,
  **and room chat**:

```
local profanity ──hit──> handle_profanity_escalation()  (DB ledger + tier)
       │miss
       ▼
local spam ──hit──> risk medium (warn)
       │miss
       ▼
Groq AI ──high risk──> handle_profanity_escalation()
       │
       └── clean / low → allow
```

### 4. Escalation tiers (`handle_profanity_escalation` RPC)

Repeat violations escalate a profile through warning → restriction → suspension:

| Tier | Effect |
|------|--------|
| warning | Profanity status banner, further violations escalate |
| restricted / muted | Content restricted (no chat/threads/materials) |
| suspended | `is_suspended()` blocks all writes via RLS |

State lives on `profiles` (restriction_level, counters) + `profanity_incidents`
/ `profanity_notifications` ledgers. Surfaced via
`get_profanity_status` / `is_profanity_restricted` and the
`ProfanityStatusBanner` in the app layout.

## Human moderation

- **Reports** (`reports` table): users can report threads, posts, materials, and
  profiles (`ReportButton`). Status flow: open → reviewing → resolved/dismissed.
- **Mod queue** (`/app/mod`, gated by `isModerator`): resolve reports, apply
  **sanctions** (warn / mute / suspend with expiry), hide content, pin/lock
  threads. `moderation_actions` keeps an audit trail.
- **Roles:** `student` → `moderator` → `admin` (on `profiles.role`; no password —
  promote via SQL). Space-level moderators (`space_members.role = 'moderator'`)
  can pin/lock threads in their space and end study rooms.

## Security model

- **RLS is the boundary** — see [Database](DATABASE.md#rls-model-the-security-backbone).
  Suspended users are blocked by `is_suspended()` in insert policies.
- **Proxy security headers** (CSP, HSTS, nosniff, frame-deny, referrer policy).
- **Open-redirect guard** in `/auth/callback` (server-provided app URL).
- **Rate limits** — `src/lib/rate-limit.ts` (e.g. forgot-password endpoint);
  `check_update_rate` RPC.
- **Secrets:** keys live only in Vercel env + `.env.local` (gitignored). Never
  commit `NEXT_PUBLIC_SUPABASE_ANON_KEY`-adjacent secrets or the service role key.

## What is AI-monitored (creation-time coverage)

| Surface | Check | High risk → |
|---------|-------|-------------|
| Threads | `checkContentWithAI` (title + body) | rejected + hidden |
| Replies / posts (incl. nested) | `checkContentWithAI` (body) | rejected + hidden |
| Study notes | `checkContentWithAI` (title + content) | rejected (error banner) |
| Link materials | `checkContentWithAI` (title + URL + description) | rejected |
| Flashcard decks | `checkContentWithAI` (title + every front/back) | rejected |
| Quizzes | `checkContentWithAI` (title + questions/options/explanations) | rejected |
| File uploads | `checkContentWithAI` (title only — binary can't be scanned) | rejected |
| Announcements | `checkContentWithAI` (title + body) | rejected |
| Meetings | `checkContentWithAI` (title + description) | rejected |
| Room chat | `checkProfanityWithEscalation` (local + escalation — no Groq round-trip for latency/cost) | high-risk message rejected |
| Automod rules | mod-defined keyword rules (see Mod dashboard) | remove = blocked, flag = hidden + logged |

All AI-checked surfaces run the local profanity + spam pre-checks first, so
obvious violations are caught instantly and the AI only decides nuanced cases.

## Study-room specific moderation

- Room chat messages run the **full** `checkProfanityWithEscalation` pipeline
  before insert; high-risk messages are rejected.
- Reactions are limited to a curated emoji set; reactions + messages are
  user-owned (delete own only).
- **End room** is creator-or-moderator only (RLS); ended rooms become read-only
  (board) and chat is disabled.
- Space-linked rooms restrict visibility + mentions to **space members**.

## QA spot checks (from the launch checklist)

- Non-member cannot read a private space (RLS).
- Non-creator cannot end someone else's study room.
- Suspended user cannot post (chat, threads, materials).
- Mod queue resolves a report; hidden content disappears for normal users.
- Profanity escalation: repeated violations warn → restrict the profile.
- No secrets in the repo or deployment logs.
