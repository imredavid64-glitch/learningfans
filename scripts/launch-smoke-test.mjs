#!/usr/bin/env node
// Launch smoke test — machine-checkable health report for the live app.
//
// Verifies, against the DEPLOYED Supabase project:
//   1. every pending migration's schema is live (tables, columns, enum values,
//      RPCs, storage buckets) via PostgREST with the service-role key,
//   2. the deployed site answers HTTP 200 and key routes aren't 404,
//   3. required env vars are present in the local environment.
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
      return `${check.table}?select=id&limit=1`;
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

async function probeCheck(check, restBase, storageBase, headers) {
  if (check.kind === "bucket") {
    const res = await fetchWithTimeout(`${storageBase}/bucket/${check.bucket}`, { headers, redirect: "manual" }).catch(() => null);
    return res ? res.status : 0;
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

  // 1) Migration checks
  const migrationResults = {};
  for (const migration of MIGRATIONS) {
    const checks = await mapLimit(migration.checks, 4, async (check) => {
      const status = await probeCheck(check, restBase, storageBase, headers);
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

  // 3) Env vars (local snapshot — informational for the optional set)
  const env = {
    required: Object.fromEntries(REQUIRED_ENV.map((k) => [k, Boolean(process.env[k])])),
    optional: Object.fromEntries(OPTIONAL_ENV.map((k) => [k, Boolean(process.env[k])])),
  };

  const migrationsOk = Object.values(migrationResults).filter((m) => m.ok).length;
  const checksTotal = MIGRATIONS.reduce((n, m) => n + m.checks.length, 0);
  const checksFailed = MIGRATIONS.reduce(
    (n, m) => n + m.checks.filter((c) => !c.ok).length,
    0,
  );
  const routesOk = Object.values(routeResults).filter((r) => r.ok).length;
  const requiredEnvOk = Object.values(env.required).filter(Boolean).length;

  const report = {
    ok:
      site.ok &&
      routesOk === ROUTES.length &&
      migrationsOk === MIGRATIONS.length &&
      requiredEnvOk === REQUIRED_ENV.length,
    checkedAt: new Date().toISOString(),
    site,
    routes: routeResults,
    migrations: migrationResults,
    env,
    summary: {
      migrations: { total: MIGRATIONS.length, ok: migrationsOk, missing: MIGRATIONS.length - migrationsOk },
      checks: { total: checksTotal, failed: checksFailed },
      routes: { total: ROUTES.length, ok: routesOk },
      requiredEnv: { total: REQUIRED_ENV.length, ok: requiredEnvOk },
    },
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Launch smoke test — ${report.checkedAt}`);
    console.log(`Site: ${appUrl} → HTTP ${site.status} ${site.ok ? "✓" : "✗"}`);
    console.log(`Routes: ${routesOk}/${ROUTES.length} ok`);
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
