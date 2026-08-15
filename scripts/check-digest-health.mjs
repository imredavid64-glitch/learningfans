#!/usr/bin/env node
// Side-effect-free verification that the DEPLOYED /api/cron/digest route is
// fully configured. Calls GET {APP_URL}/api/cron/digest?dry=1 with
// `Authorization: Bearer $CRON_SECRET` — the route's dry mode validates the
// secret, probes the digest pipeline's surface (notifications, parent_digests,
// user_stats, get_leaderboard), then short-circuits BEFORE
// send_weekly_digests / send_parent_digests / party reminders.
//
// Mirrors check-push-health.mjs (same contract; no VAPID branch — the digest
// route has no push component).
//
// Exit codes: 0 = fully configured, 1 = something is wrong, 2 = local config error.
//
// Usage:
//   node scripts/check-digest-health.mjs
//   node scripts/check-digest-health.mjs --json
//   node scripts/check-digest-health.mjs --url https://learningfans.vercel.app

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./apply-migrations.mjs";
import { renderDb } from "./check-push-health.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function parseArgs(argv) {
  const args = { json: false, url: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(
        "check-digest-health.mjs — verify the deployed digest cron route is configured\n\n" +
          "Options:\n" +
          "  --json              print only the raw JSON response\n" +
          "  --url <url>         site URL (default: NEXT_PUBLIC_APP_URL)\n" +
          "  -h, --help          show this help\n\n" +
          "Env (from process.env or .env.local):\n" +
          "  NEXT_PUBLIC_APP_URL  deployed site URL\n" +
          "  CRON_SECRET          must match the Vercel CRON_SECRET env var\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotEnv(join(root, ".env.local"));

  const appUrl = (args.url || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET || "";

  if (!appUrl || !cronSecret) {
    console.error(
      "Missing required config: NEXT_PUBLIC_APP_URL and CRON_SECRET\n" +
        "must be in .env.local (or exported).\n",
    );
    process.exit(2);
  }

  const res = await fetch(`${appUrl}/api/cron/digest?dry=1`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  }).catch(() => null);

  if (!res) {
    console.error(`Could not reach ${appUrl}/api/cron/digest?dry=1 (network error).`);
    process.exit(1);
  }

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }

  if (args.json) {
    console.log(JSON.stringify({ httpStatus: res.status, ...body }, null, 2));
  } else {
    console.log(`HTTP ${res.status} — ${appUrl}/api/cron/digest?dry=1`);
    if (res.status === 401) {
      console.log("✗ Unauthorized: CRON_SECRET doesn't match the deployed route (or it's unset in Vercel).");
    } else if (res.status === 200 && body.ok) {
      console.log("✓ Fully configured (digest pipeline ready).");
      console.log(`  DB: ${renderDb(body.db)}`);
    } else {
      console.log(JSON.stringify(body, null, 2));
    }
  }

  process.exit(res.status === 200 && body.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
