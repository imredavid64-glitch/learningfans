# LearningFans as "a Reddit for learners" — blueprint

The goal: make every study community feel like a subreddit **built for learning** —
rules and moderators, ranked posts, comments, voting, and discovery — but where
the "posts" are study things: PDFs, images, notes, links, quizzes, and flashcards.
This document maps the vision, what already exists, and a phased brainstorm of
functions to get there.

> Status: **Phase 1 shipped 2026-08-12** (community rules, moderator
> announcements, content filter chips). Everything below is a candidate —
> nothing is promised.

## The mental model

| Reddit | LearningFans equivalent | Status |
|--------|------------------------|--------|
| Subreddit | Space (community) | ✅ |
| Subreddit rules | `spaces.rules` (numbered, mod-editable) | ✅ just shipped |
| Mod announcements | `spaces.announcements` (📌 pinned cards) | ✅ just shipped |
| Moderators | `space_members.role = 'moderator'` | ✅ |
| Posts | Threads | ✅ |
| Text posts / links | Threads + study materials | ✅ |
| Comments | Thread replies (flat) | ⚠️ flat, not nested |
| Upvotes | `material_upvotes` on materials; nothing on threads | ⚠️ partial |
| Karma | XP / streaks / leaderboard | ✅ |
| Content types | file / link / note / flashcard_set | ✅ |
| r/all discovery | `/app/spaces` browse | ⚠️ minimal |
| Automod | Profanity pipeline + escalation | ⚠️ rules-based only |

## Phase 1 — shipped ✅

- **Community rules** — numbered list in the sidebar; moderators edit inline
  (add/remove/reorder via a client panel) and save. Up to 20 rules,
  140-char titles, 500-char bodies.
- **Moderator announcements** — 📌 pinned cards at the top of the community,
  posted/deleted by moderators (up to 20, newest first).
- **Mod gating** — space moderators *and* app moderators can manage any
  community (new RLS policy).
- **Content filters** — Reddit-style chip row on the materials feed:
  All / PDFs / Images / Files / Links / Notes / Quizzes (MIME-aware now that
  uploads record their mime type).

## Phase 2 — the subreddit core (recommended next)

**Community identity**
- Community **icon + banner** (`spaces.metadata`), shown in browse lists + header.
- **Post flairs / tags** (`threads.flair text`): mod-defined flair list per
  community ("Homework help", "Exam prep", "Resource", "AMA"); color-coded badges.
- **User flairs** (per-community): e.g. "TA", "Top contributor", "Verified".
- **Sidebar widgets**: community description, rules, mods (done), upcoming
  events, top contributors this week.

**Voting & ranking**
- Upvote/downvote on **threads** (mirror `material_upvotes` → a generic
  `votes` table or `threads.score` column + `post_votes`).
- **Sorting tabs** on the community feed: Hot / New / Top (day/week/all) /
  Controversial — Hot = decayed score (score / age^1.5), Top = raw score.
- **Comments sorted** by Top / New; "best" by vote-weighted position.

**Discovery**
- Per-community search + tag pages (`/app/spaces/[slug]?tag=exam-prep`).
- **Community directory** page: most members, most active this week, newest.
- "My communities" row on the dashboard (exists as spaces list — make it a feed).

## Phase 3 — learning-first posts (the "learning features")

**Content posts, Reddit style**
- **PDF posts** — in-feed PDF preview + "Add to my library"; searching a
  community for PDFs is one click (filter chips ✅).
- **Image posts** — thumbnail grid + lightbox (images already compress on upload).
- **Quiz posts** — take the quiz inline, get an instant score, see the
  community leaderboard for that quiz; "Add to my review queue" pipes results
  into the existing SM-2 flashcard system.
- **Flashcard posts** — preview first N cards inline; "Review this deck" opens
  the existing spaced-repetition UI.
- **Note posts** — rich markdown rendering (basic text today).
- **"Ask the community" post type** — homework/help posts with a mandatory
  "what I've tried" field (the classic r/learnmath rule), spoiler-taggable
  answers.

**Comments**
- Nested replies (parent_id on `posts`) + reply chains.
- Mod tools on comments: distinguish ("official answer"), remove, lock.
- @mentions in posts/comments → bell (reuse the room-mention pipeline).

**Search & save**
- Bookmark/save posts to a personal collection; "search my saves".
- Per-community search box.

## Phase 4 — community & engagement loops

- **Community home feed** (`/app`): Hot posts + new materials + live rooms +
  upcoming events from your communities, one scroll.
- **Karma as a currency**: XP already exists; add thread/post upvote XP,
  "community reputation" per space, and trophies/badges.
- **Weekly digest** notification: "r/Calculus101 had 12 new resources, 3 quizzes,
  1 study party this week".
- **Study parties**: scheduled live rooms promoted on the community feed
  (meetings already exist — cross-link them).
- **Mod dashboards**: post approval queue, removal reasons, ban list, automod
  keyword rules (extend `profanity_escalation` into community-configured rules),
  "show rules before posting" confirmation.
- **Crosspost / share**: "Share to study room" from any post/material.

## Free-tier discipline (how this stays cheap)

- Rules/announcements/flairs live as **jsonb on the space row** — no new tables,
  one row per community.
- Votes as a **single `post_votes` table** with a composite PK (no unique rows
  per vote event); scores cached on the post row.
- Quiz results and review progress stay in **localStorage** (existing SRS
  pattern); only leaderboard summaries touch the DB.
- Comments remain one table with a `parent_id`; realtime via the existing
  `posts` publication.

## Build order suggestion

1. **Phase 2a**: thread upvotes + Hot/New/Top sorting + community flair field
   (threads + spaces jsonb). Highest impact-per-effort — it's what makes a feed
   feel like Reddit.
2. **Phase 2b**: community directory + per-community search.
3. **Phase 3a**: quiz posts + PDF preview (both reuse existing infra).
4. **Phase 3b**: nested comments.
5. **Phase 4**: home feed + karma badges + automod rules.
