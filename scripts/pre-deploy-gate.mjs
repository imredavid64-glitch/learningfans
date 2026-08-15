#!/usr/bin/env node
// Pre-deploy gate — run before `vercel --prod`.
//
// Chains the four config checks that must all pass before a deploy is worth
// shipping:
//   1. check:env         — .env.local / .env.example vs Vercel production drift
//   2. check:migrations  — pending_apply.sql batch is in sync with the CI list
//   3. check:push        — deployed /api/push/send?dry=1 (auth + VAPID + 4 probes)
//   4. check:digest      — deployed /api/cron/digest?dry=1 (auth + 4 probes)
//
// Each step runs in order and fails fast on the first red check; the JSON mode
// (--json) emits the per-step results for CI ingestion. Exit codes: 0 = gate
// passed, 1 = a check failed, 2 = usage/config error.
//
// Usage:
//   node scripts/pre-deploy-gate.mjs
//   node scripts/pre-deploy-gate.mjs --json
//   node scripts/pre-deploy-gate.mjs --skip push,digest

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const NODE = process.execPath;

const STEPS = [
  { id: "env", label: "Env drift", script: "scripts/check-env-drift.mjs" },
  { id: "migrations", label: "Migration batch sync", script: "scripts/check-migration-batch.mjs" },
  { id: "push", label: "Push dry check (4 probes)", script: "scripts/check-push-health.mjs" },
  { id: "digest", label: "Digest dry check (4 probes)", script: "scripts/check-digest-health.mjs" },
];

function parseArgs(argv) {
  const args = { json: false, skip: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--skip") {
      for (const id of (argv[++i] || "").split(",")) if (id) args.skip.add(id.trim());
    } else if (a === "--help" || a === "-h") {
      console.log(
        "pre-deploy-gate.mjs — run the four pre-deploy config checks in sequence\n\n" +
          "Steps: env → migrations → push → digest (each fails fast on red)\n\n" +
          "Options:\n" +
          "  --json             emit only the JSON results\n" +
          "  --skip <ids>       comma-separated step ids to skip (env,migrations,push,digest)\n" +
          "  -h, --help         show this help\n\n" +
          "Env: check:push / check:digest need NEXT_PUBLIC_APP_URL + CRON_SECRET\n" +
          "     (from process.env or .env.local) to verify the deployed routes.\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function runStep(step) {
  const res = spawnSync(NODE, [join(root, step.script)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  return {
    id: step.id,
    label: step.label,
    exit: res.status === null ? 1 : res.status,
    error: res.error ? String(res.error) : undefined,
    output: (res.stdout || "").trim(),
    stderr: (res.stderr || "").trim(),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const active = STEPS.filter((s) => !args.skip.has(s.id));
  if (!active.length) {
    console.error("No steps to run — every step was skipped.\n");
    process.exit(2);
  }

  const results = [];
  for (const step of active) {
    const r = runStep(step);
    results.push(r);
    if (!args.json) {
      const ok = r.exit === 0;
      console.log(`${ok ? "✓" : "✗"} ${step.label} (${step.id}) — exit ${r.exit}`);
      if (!ok && r.output) {
        // Surface the check's own verdict lines, indented.
        for (const line of r.output.split("\n").slice(0, 12)) {
          if (line.trim()) console.log(`    ${line}`);
        }
      }
    }
    if (r.exit !== 0) break; // fail fast on first red
  }

  const passed = results.filter((r) => r.exit === 0).length;
  const failed = results.filter((r) => r.exit !== 0).length;
  const skipped = STEPS.filter((s) => args.skip.has(s.id)).length;

  const summary = {
    ok: failed === 0,
    total: STEPS.length,
    ran: results.length,
    passed,
    failed,
    skipped,
    steps: Object.fromEntries(results.map((r) => [r.id, { ok: r.exit === 0, exit: r.exit }])),
  };

  if (args.json) {
    console.log(JSON.stringify({ ok: summary.ok, checkedAt: new Date().toISOString(), summary }, null, 2));
  } else {
    console.log(`\nGate: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""} → ${summary.ok ? "READY TO DEPLOY" : "NOT READY — fix the failing check(s) above"}`);
  }

  process.exit(summary.ok ? 0 : 1);
}

main();
