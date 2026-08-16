#!/usr/bin/env node
// Launch smoke test — machine-checkable health report for the live app.
//
// Verifies, against the DEPLOYED Supabase project:
//   1. every pending migration's schema is live (tables, columns, enum values,
//      RPCs, storage buckets) via PostgREST with the service-role key. RPCs
//      are checked against the PostgREST OpenAPI spec (the definitive
//      schema-cache truth — a bare rpc() call lies for functions with named
//      params, and trigger functions are never exposed via REST),
//   2. the deployed site answers HTTP 200 and key routes aren't 404,
//   3. cron readiness — the deployed /api/push/send?dry=1 (auth + VAPID +
//      push pipeline tables) and /api/cron/digest?dry=1 (digest pipeline
//      tables), both side-effect-free by design, when CRON_SECRET is set.
//      Together they report the full 8-probe cron surface,
//   4. required env vars are present in the local environment.
//
// Emits a JSON health report (--json) and exits 0 when everything is live,
// 1 when any required check fails, 2 on configuration errors.
//
// Usage:
//   node scripts/launch-smoke-test.mjs            # human-readable report
//   node scripts/launch-smoke-test.mjs --json     # machine-readable JSON
//   node scripts/launch-smoke-test.mjs --url https://learningfans.vercel.app
//   node scripts/launch-smoke-test.mjs --base-supabase-url https://xxx.supabase.co

import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadDotEnv } from "./apply-migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];
const OPTIONAL_ENV = [
  "GROQ_API_KEY",
  "CRON_SECRET",
  "VAPID_SUBJECT",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "ARCHIVE_SUPABASE_URL",
  "ARCHIVE_SUPABASE_SERVICE_KEY",
  "GEMINI_API_KEY",
  "SUPABASE_ACCESS_TOKEN",
];

// Every migration in the batch + the schema surface that proves it's live.
// kinds: table | column | enum | rpc | bucket
const MIGRATIONS = [
  {
    id: "0000_user_profiles_upload_types",
    name: "User profiles + upload types",
    checks: [
      { kind: "column", table: "profiles", column: "parent_email", name: "profiles.parent_email" },
      { kind: "column", table: "profiles", column: "major", name: "profiles.major" },
    ],
  },
  {
    id: "0001_parent_digests",
    name: "Parent progress digests",
    checks: [{ kind: "table", table: "parent_digests", name: "parent_digests table" }],
  },
  {
    id: "0002_room_moderation",
    name: "Room chat moderation (mute/ban)",
    checks: [{ kind: "table", table: "study_room_moderation", name: "study_room_moderation table" }],
  },
  {
    id: "0003_ask_community",
    name: "Ask the community",
    checks: [
      { kind: "column", table: "threads", column: "kind", name: "threads.kind" },
      { kind: "column", table: "threads", column: "accepted_answer_id", name: "threads.accepted_answer_id" },
    ],
  },
  {
    id: "0004_study_parties",
    name: "Study parties + sessions",
    checks: [
      { kind: "column", table: "study_rooms", column: "starts_at", name: "study_rooms.starts_at" },
      { kind: "table", table: "study_sessions", name: "study_sessions table" },
    ],
  },
  {
    id: "0005_accountability_groups",
    name: "Accountability groups",
    checks: [
      { kind: "table", table: "accountability_groups", name: "accountability_groups table" },
      { kind: "table", table: "accountability_checkins", name: "accountability_checkins table" },
    ],
  },
  {
    id: "0006_quiz_integrity",
    name: "Quiz integrity guard",
    checks: [{ kind: "column", table: "quiz_attempts", column: "flagged", name: "quiz_attempts.flagged" }],
  },
  {
    id: "0007_party_rsvps",
    name: "Party RSVPs + reminders",
    checks: [{ kind: "table", table: "study_room_rsvps", name: "study_room_rsvps table" }],
  },
  {
    id: "0008_quiz_posts",
    name: "Quiz posts + leaderboard",
    checks: [
      { kind: "table", table: "quiz_attempts", name: "quiz_attempts table" },
      { kind: "enum", table: "study_materials", column: "type", value: "quiz", name: "material_type = 'quiz'" },
    ],
  },
  {
    id: "0009_post_flairs",
    name: "Post flairs",
    checks: [
      { kind: "column", table: "spaces", column: "flairs", name: "spaces.flairs" },
      { kind: "column", table: "threads", column: "flair_id", name: "threads.flair_id" },
    ],
  },
  {
    id: "0010_community_branding",
    name: "Community branding",
    checks: [
      { kind: "column", table: "spaces", column: "icon_url", name: "spaces.icon_url" },
      { kind: "bucket", bucket: "community-assets", name: "community-assets bucket" },
    ],
  },
  {
    id: "0011_nested_replies",
    name: "Nested replies",
    checks: [{ kind: "column", table: "posts", column: "parent_id", name: "posts.parent_id" }],
  },
  {
    id: "0012_saved_items",
    name: "Save / bookmark collections",
    checks: [
      { kind: "table", table: "saved_items", name: "saved_items table" },
      { kind: "table", table: "saved_collections", name: "saved_collections table" },
    ],
  },
  {
    id: "0013_weekly_digests",
    name: "Weekly community digests",
    checks: [{ kind: "rpc", rpc: "send_weekly_digests", name: "send_weekly_digests RPC" }],
  },
  {
    id: "0014_mod_dashboard_automod",
    name: "Mod dashboard + automod",
    checks: [
      { kind: "column", table: "spaces", column: "automod_rules", name: "spaces.automod_rules" },
      { kind: "column", table: "moderation_actions", column: "space_id", name: "moderation_actions.space_id" },
    ],
  },
  {
    id: "0015_chat_moderation_queue",
    name: "Batched AI room-chat moderation",
    checks: [
      { kind: "column", table: "study_room_messages", column: "hidden", name: "study_room_messages.hidden" },
      { kind: "table", table: "chat_moderation_queue", name: "chat_moderation_queue table" },
    ],
  },
  {
    id: "0016_message_reports",
    name: "Message reports",
    checks: [
      { kind: "enum", table: "reports", column: "target_type", value: "message", name: "report_target_type = 'message'" },
    ],
  },
  {
    id: "0017_database_housekeeping",
    name: "DB housekeeping (500 MB cap)",
    checks: [
      { kind: "rpc", rpc: "get_table_sizes", name: "get_table_sizes RPC" },
      { kind: "rpc", rpc: "run_housekeeping", name: "run_housekeeping RPC" },
    ],
  },
  // Folded-in excluded migrations (audit 2026-08-15 — previously NOT on live).
  {
    id: "security_hardening",
    name: "Security hardening (audit_log + rate limit)",
    checks: [
      { kind: "table", table: "audit_log", name: "audit_log table" },
      { kind: "column", table: "profiles", column: "updated_at", name: "profiles.updated_at" },
    ],
  },
  {
    id: "profanity_escalation",
    name: "Profanity escalation",
    checks: [
      { kind: "table", table: "profanity_incidents", name: "profanity_incidents table" },
      { kind: "table", table: "profanity_notifications", name: "profanity_notifications table" },
      { kind: "rpc", rpc: "get_profanity_status", name: "get_profanity_status RPC" },
    ],
  },
  {
    id: "notifications_xp",
    name: "Notifications + XP/stats",
    checks: [
      { kind: "table", table: "notifications", name: "notifications table" },
      { kind: "table", table: "user_stats", name: "user_stats table" },
      { kind: "rpc", rpc: "get_leaderboard", name: "get_leaderboard RPC" },
    ],
  },
  {
    id: "reply_notifications",
    name: "Reply notifications",
    // Trigger-only migration: notify_new_post (returns trigger) is never
    // exposed via PostgREST, so it's verified via the table its trigger
    // writes into (same dependsOn logic as scripts/audit-excluded-migrations.mjs).
    checks: [{ kind: "table", table: "notifications", name: "notifications table (reply-trigger dependency)" }],
  },
  {
    id: "web_push",
    name: "Web push subscriptions",
    checks: [
      { kind: "table", table: "push_subscriptions", name: "push_subscriptions table" },
      { kind: "column", table: "notifications", column: "push_sent_at", name: "notifications.push_sent_at" },
    ],
  },
  {
    id: "event_reminders",
    name: "Schedule event reminders",
    checks: [{ kind: "table", table: "schedule_event_reminders", name: "schedule_event_reminders table" }],
  },
  {
    id: "emoji_reactions",
    name: "Emoji reactions",
    checks: [{ kind: "table", table: "study_room_message_reactions", name: "study_room_message_reactions table" }],
  },
  {
    id: "community_rules",
    name: "Community rules + announcements",
    checks: [
      { kind: "column", table: "spaces", column: "rules", name: "spaces.rules" },
      { kind: "column", table: "spaces", column: "announcements", name: "spaces.announcements" },
    ],
  },
  {
    id: "thread_votes",
    name: "Thread upvotes/downvotes",
    checks: [
      { kind: "table", table: "post_votes", name: "post_votes table" },
      { kind: "column", table: "threads", column: "score", name: "threads.score" },
    ],
  },
];

// Base-critical schema surface that the app needs REGARDLESS of the batch —
// the class of gap where check:push found notifications/user_stats/etc. were
// silently missing on live despite being "known applied". These are audited
// against live (scripts/audit-excluded-migrations.mjs) and are NOT in the batch.
const BASE_TABLES = [
  { kind: "table", table: "profiles", name: "profiles" },
  { kind: "table", table: "spaces", name: "spaces" },
  { kind: "table", table: "threads", name: "threads" },
  { kind: "table", table: "posts", name: "posts" },
  { kind: "table", table: "study_materials", name: "study_materials" },
  { kind: "table", table: "schedule_events", name: "schedule_events" },
  { kind: "table", table: "reports", name: "reports" },
  { kind: "table", table: "moderation_actions", name: "moderation_actions" },
  { kind: "table", table: "meetings", name: "meetings" },
  { kind: "table", table: "meeting_participants", name: "meeting_participants" },
  { kind: "table", table: "meeting_reminders", name: "meeting_reminders" },
  { kind: "table", table: "schools", name: "schools" },
  { kind: "table", table: "audit_log", name: "audit_log" },
  { kind: "table", table: "study_rooms", name: "study_rooms" },
  { kind: "table", table: "study_room_messages", name: "study_room_messages" },
  { kind: "column", table: "spaces", column: "join_password_hash", name: "spaces.join_password_hash" },
  { kind: "rpc", rpc: "get_db_size", name: "get_db_size RPC" },
];

const ROUTES = ["/", "/login", "/signup", "/app/feed", "/app/communities", "/app/study-rooms", "/app/schedule"];

function parseArgs(argv) {
  const args = { json: false, url: undefined, supabaseUrl: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--base-supabase-url") args.supabaseUrl = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(
        "launch-smoke-test.mjs — verify every migration/feature is live\n\n" +
          "Options:\n" +
          "  --json                    emit only the JSON health report\n" +
          "  --url <url>               site URL (default: NEXT_PUBLIC_APP_URL)\n" +
          "  --base-supabase-url <url> Supabase project URL (default: NEXT_PUBLIC_SUPABASE_URL)\n" +
          "  -h, --help                show this help\n\n" +
          "Env: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required\n" +
          "     (read from process.env or .env.local).\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  return fetch(url, { ...options, signal: ac.signal }).finally(() => clearTimeout(t));
}

function okFor(kind, status) {
  if (!status) return false; // 0 = network error / timeout
  if (kind === "rpc") return status === 200 || status === 400; // 400 = exists but needs args
  return status === 200;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function restPath(check) {
  switch (check.kind) {
    case "table":
      // select=* — composite-PK tables (meeting_participants) have no `id`.
      return `${check.table}?select=*&limit=1`;
    case "column":
      return `${check.table}?select=${check.column}&limit=1`;
    case "enum":
      return `${check.table}?select=id&${check.column}=eq.${check.value}&limit=1`;
    case "rpc":
      return `rpc/${check.rpc}`;
    default:
      return null;
  }
}

async function probeCheck(check, restBase, storageBase, headers, specPaths) {
  if (check.kind === "bucket") {
    const res = await fetchWithTimeout(`${storageBase}/bucket/${check.bucket}`, { headers, redirect: "manual" }).catch(() => null);
    return res ? res.status : 0;
  }
  // RPCs are verified against the PostgREST OpenAPI spec — the definitive
  // schema-cache truth. A bare no-arg rpc() call returns PGRST202 for ANY
  // function with named params, and trigger functions (returns trigger) are
  // never exposed via PostgREST at all, so REST status codes can't serve as
  // an existence check (see scripts/audit-excluded-migrations.mjs).
  if (check.kind === "rpc") {
    if (!specPaths) return 0; // spec fetch failed → treat as network error
    return specPaths.has(`/rpc/${check.rpc}`) ? 200 : 404;
  }
  const path = restPath(check);
  if (!path) return 0;
  const res = await fetchWithTimeout(`${restBase}/${path}`, { headers, redirect: "manual" }).catch(() => null);
  return res ? res.status : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotEnv(join(root, ".env.local"));

  const supabaseUrl = (args.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const appUrl = (args.url || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing required config: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n" +
        "must be in .env.local (or exported).\n",
    );
    process.exit(2);
  }

  const restBase = `${supabaseUrl}/rest/v1`;
  const storageBase = `${supabaseUrl}/storage/v1`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  // Fetch the PostgREST OpenAPI spec once — the definitive schema-cache truth
  // for tables and callable RPCs (see probeCheck).
  let specPaths = null;
  {
    const res = await fetchWithTimeout(`${restBase}/`, {
      headers: { ...headers, Accept: "application/openapi+json" },
    }).catch(() => null);
    if (res && res.ok) {
      const spec = await res.json().catch(() => null);
      if (spec && spec.paths) specPaths = new Set(Object.keys(spec.paths));
    }
  }

  // 1) Migration checks
  const migrationResults = {};
  for (const migration of MIGRATIONS) {
    const checks = await mapLimit(migration.checks, 4, async (check) => {
      const status = await probeCheck(check, restBase, storageBase, headers, specPaths);
      const ok = okFor(check.kind, status);
      return { name: check.name, kind: check.kind, status, ok };
    });
    migrationResults[migration.id] = {
      id: migration.id,
      name: migration.name,
      ok: checks.every((c) => c.ok),
      checks,
    };
  }

  // 1b) Base tables (assumed-applied schema, independent of the batch)
  const baseResults = await mapLimit(BASE_TABLES, 6, async (check) => {
    const status = await probeCheck(check, restBase, storageBase, headers, specPaths);
    const ok = okFor(check.kind, status);
    return { name: check.name, kind: check.kind, status, ok };
  });
  const baseOkCount = baseResults.filter((r) => r.ok).length;

  // 2) Site + routes
  const siteRes = await fetchWithTimeout(appUrl, { redirect: "follow" }).catch(() => null);
  const site = siteRes
    ? { url: appUrl, status: siteRes.status, ok: siteRes.ok || siteRes.status === 200 }
    : { url: appUrl, status: 0, ok: false };

  const routeResults = {};
  for (const route of ROUTES) {
    const res = await fetchWithTimeout(`${appUrl}${route}`, { redirect: "manual" }).catch(() => null);
    const status = res ? res.status : 0;
    routeResults[route] = { status, ok: status !== 0 && status !== 404 && status < 500 };
  }

  // 2b) Cron-route readiness — verify the DEPLOYED dry modes via their
  //     side-effect-free endpoints (auth + pipeline tables; nothing is sent).
  //     Both run only when CRON_SECRET is available locally (the caller's
  //     credential). Together they report the full 8-probe cron surface:
  //     push (push_subscriptions, notifications, user_stats, get_leaderboard)
  //     + digest (notifications, parent_digests, user_stats, get_leaderboard).
  const cronSecret = process.env.CRON_SECRET || "";
  async function checkDryRoute(path) {
    const res = await fetchWithTimeout(`${appUrl}${path}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch(() => null);
    if (!res) return { ok: false, checked: false, error: "network error reaching the dry endpoint" };
    const body = await res.json().catch(() => null);
    const healthy = res.status === 200 && body?.ok === true;
    return {
      ok: healthy,
      checked: true,
      httpStatus: res.status,
      auth: res.status === 401 ? "mismatch" : res.status === 200 ? "ok" : "failed",
      body: body ?? null,
      db: body?.db ?? null,
    };
  }

  let push = { ok: false, checked: false };
  let digest = { ok: false, checked: false };
  if (cronSecret) {
    push = await checkDryRoute("/api/push/send?dry=1");
    digest = await checkDryRoute("/api/cron/digest?dry=1");
    // VAPID lives only on the push route's dry response.
    push.vapid = push.body?.vapid
      ? { configured: true, subject: push.body.vapid.subject, publicKey: push.body.vapid.publicKey }
      : null;
  } else {
    const err = "CRON_SECRET not set locally — cannot verify the deployed cron routes (see env.optional)";
    push = { ok: false, checked: false, error: err };
    digest = { ok: false, checked: false, error: err };
  }

  // 3) Env vars (local snapshot — informational for the optional set)
  const env = {
    required: Object.fromEntries(REQUIRED_ENV.map((k) => [k, Boolean(process.env[k])])),
    optional: Object.fromEntries(OPTIONAL_ENV.map((k) => [k, Boolean(process.env[k])])),
  };

  const migrationsOk = Object.values(migrationResults).filter((m) => m.ok).length;
  const baseOk = baseOkCount === BASE_TABLES.length;
  const checksTotal = MIGRATIONS.reduce((n, m) => n + m.checks.length, 0);
  // Count from the LIVE results — the static MIGRATIONS config has no `ok`.
  const checksFailed = Object.values(migrationResults).reduce(
    (n, m) => n + m.checks.filter((c) => !c.ok).length,
    0,
  );
  const routesOk = Object.values(routeResults).filter((r) => r.ok).length;
  const requiredEnvOk = Object.values(env.required).filter(Boolean).length;

  // Fail only when a cron route was verified and is unhealthy; an unverified
  // check (no local CRON_SECRET) is reported but doesn't gate the exit code.
  const pushOk = !push.checked || push.ok;
  const digestOk = !digest.checked || digest.ok;
  const cronProbes = [
    ...(push.db ? Object.entries(push.db).map(([k, v]) => ({ probe: `push.${k}`, status: v })) : []),
    ...(digest.db ? Object.entries(digest.db).map(([k, v]) => ({ probe: `digest.${k}`, status: v })) : []),
  ];
  const cronProbesOk = cronProbes.filter((p) => p.status === "ok").length;

  const report = {
    ok:
      site.ok &&
      routesOk === ROUTES.length &&
      migrationsOk === MIGRATIONS.length &&
      baseOk &&
      requiredEnvOk === REQUIRED_ENV.length &&
      pushOk &&
      digestOk,
    checkedAt: new Date().toISOString(),
    site,
    routes: routeResults,
    cron: { push, digest, probes: cronProbes },
    migrations: migrationResults,
    base: baseResults,
    env,
    summary: {
      migrations: { total: MIGRATIONS.length, ok: migrationsOk, missing: MIGRATIONS.length - migrationsOk },
      base: { total: BASE_TABLES.length, ok: baseOkCount, missing: BASE_TABLES.length - baseOkCount },
      checks: { total: checksTotal, failed: checksFailed },
      routes: { total: ROUTES.length, ok: routesOk },
      push: { verified: push.checked, ok: pushOk },
      digest: { verified: digest.checked, ok: digestOk },
      cronProbes: { total: cronProbes.length, ok: cronProbesOk, missing: cronProbes.length - cronProbesOk },
      requiredEnv: { total: REQUIRED_ENV.length, ok: requiredEnvOk },
    },
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Launch smoke test — ${report.checkedAt}`);
    console.log(`Site: ${appUrl} → HTTP ${site.status} ${site.ok ? "✓" : "✗"}`);
    console.log(`Routes: ${routesOk}/${ROUTES.length} ok`);
    if (push.checked) {
      const db = push.db ? `db: ${Object.entries(push.db).map(([k, v]) => `${k}=${v}`).join(", ")}` : "";
      console.log(`Push: ${push.ok ? "✓" : "✗"} auth=${push.auth}${push.vapid ? ", VAPID configured" : ""} ${db}`);
    } else {
      console.log(`Push: ? unverified (${push.error || "no CRON_SECRET locally"})`);
    }
    if (digest.checked) {
      const db = digest.db ? `db: ${Object.entries(digest.db).map(([k, v]) => `${k}=${v}`).join(", ")}` : "";
      console.log(`Digest: ${digest.ok ? "✓" : "✗"} auth=${digest.auth} ${db}`);
    } else {
      console.log(`Digest: ? unverified (${digest.error || "no CRON_SECRET locally"})`);
    }
    if (cronProbes.length) {
      const ok = cronProbes.filter((p) => p.status === "ok").length;
      console.log(`Cron probes: ${ok}/${cronProbes.length} ok`);
    }
    console.log(`Base tables: ${baseOkCount}/${BASE_TABLES.length} ok`);
    for (const b of baseResults) {
      if (!b.ok) console.log(`  ✗ ${b.name} (HTTP ${b.status})`);
    }
    console.log(`Migrations: ${report.summary.migrations.ok}/${MIGRATIONS.length} live (${checksFailed} failing checks)`);
    for (const m of Object.values(migrationResults)) {
      console.log(`  ${m.ok ? "✓" : "✗"} ${m.id}`);
      for (const c of m.checks) {
        if (!c.ok) console.log(`      ✗ ${c.name} (HTTP ${c.status})`);
      }
    }
    const missingReq = REQUIRED_ENV.filter((k) => !env.required[k]);
    if (missingReq.length) console.log(`Missing required env: ${missingReq.join(", ")}`);
    console.log(`Result: ${report.ok ? "ALL SYSTEMS LIVE" : "FAILING — see above"}`);
  }

  process.exit(report.ok ? 0 : 1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
