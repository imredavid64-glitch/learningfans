#!/usr/bin/env node
// Env-var drift check — catches missing/mis-typed variables BEFORE deploying.
//
// Compares three sources:
//   .env.example          the documented contract (a var is "optional" when the
//                         comment block above it says so)
//   .env.local            what local dev actually has
//   Vercel production     what the deployed site will read (via `vercel env ls`)
//
// Fails (exit 1) when a non-optional .env.example variable is missing from
// Vercel production.
// Warns when: an optional var is missing from Vercel, dev is missing documented
// vars, a NEXT_PUBLIC_ var set locally isn't in Vercel (the deploy would build
// without it), or a NEXT_PUBLIC_* var is stored as Sensitive (type "sensitive")
// in Vercel — NEXT_PUBLIC values are meant to ship to the browser, so hiding
// them as secrets is contradictory and risks them not reaching the client bundle.
//
// Exit codes: 0 = ready, 1 = failures found, 2 = couldn't run the check.
//
// Usage: node scripts/check-env-drift.mjs [--json]

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function printHelp() {
  console.log(
    "check-env-drift.mjs — compare .env.example / .env.local against Vercel production\n\n" +
      "Options:\n" +
      "  --json        emit only the JSON report\n" +
      "  -h, --help    show this help\n\n" +
      "Requires the Vercel CLI to be authenticated (npx vercel whoami).\n" +
      "Reads .env.example and .env.local from the project root.\n",
  );
}

// Parse KEY=VALUE lines; a key is "optional" when the comment block directly
// above it mentions the word optional (matches .env.example conventions).
function parseEnvFile(path) {
  const out = new Map();
  let pendingComment = "";
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      pendingComment += " " + trimmed.slice(1);
      continue;
    }
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      out.set(m[1], { optional: /optional/i.test(pendingComment) });
    }
    pendingComment = ""; // blank line or section header resets the comment block
  }
  return out;
}

// Fetch the Vercel production env via the CLI (authenticated locally).
function getVercelProdEnv() {
  const raw = execFileSync(
    "npx",
    ["vercel", "env", "ls", "production", "--json"],
    { encoding: "utf8", cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  // The CLI prints a "Retrieving project…" progress line before the JSON.
  const data = JSON.parse(raw.slice(raw.indexOf("{")));
  const map = new Map();
  for (const e of data.envs || []) {
    if (!e.key) continue;
    const targets = Array.isArray(e.target) ? e.target : [];
    if (targets.length > 0 && !targets.includes("production")) continue;
    map.set(e.key, { type: e.type || "plain" });
  }
  return map;
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const example = parseEnvFile(join(root, ".env.example"));
  const localPath = join(root, ".env.local");
  const local = existsSync(localPath) ? parseEnvFile(localPath) : new Map();

  let vercel;
  try {
    vercel = getVercelProdEnv();
  } catch (err) {
    console.error(`Could not read Vercel production env — is the CLI authenticated?\n  ${err.message.split("\n")[0]}`);
    process.exit(2);
  }

  const failures = [];
  const warnings = [];
  const infos = [];

  for (const [key, meta] of example) {
    if (!vercel.has(key)) {
      const msg = `${key}: required by .env.example but missing from Vercel production`;
      if (meta.optional) warnings.push(`${msg} (marked optional — OK to defer)`);
      else failures.push(msg);
    }
  }

  // NEXT_PUBLIC_* stored as Sensitive is contradictory (the value is meant to be
  // public) and risks it not reaching the client bundle. Flag loudly, don't block.
  for (const [key, meta] of vercel) {
    if (key.startsWith("NEXT_PUBLIC_") && meta.type === "sensitive") {
      warnings.push(
        `${key}: stored Sensitive in Vercel — NEXT_PUBLIC_ values are meant to be public; remove & re-add as plain (non-sensitive) so they're reliably inlined for the browser`,
      );
    }
  }

  for (const [key] of example) {
    if (!local.has(key)) {
      warnings.push(`${key}: in .env.example but missing from .env.local (local dev may degrade)`);
    }
  }
  for (const key of local.keys()) {
    if (!example.has(key)) {
      infos.push(`${key}: in .env.local but not documented in .env.example — add it there if it's expected in prod`);
    }
    if (key.startsWith("NEXT_PUBLIC_") && !vercel.has(key)) {
      warnings.push(`${key}: set locally but missing from Vercel production — the deploy would build without it`);
    }
  }

  const report = {
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    project: "learningfans",
    failures,
    warnings,
    infos,
    summary: {
      example: example.size,
      local: local.size,
      vercel: vercel.size,
      failures: failures.length,
      warnings: warnings.length,
    },
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Env drift check — ${report.checkedAt}`);
    console.log(`Sources: .env.example (${report.summary.example}) · .env.local (${report.summary.local}) · Vercel production (${report.summary.vercel})`);
    for (const f of report.failures) console.log(`✗ ${f}`);
    for (const w of report.warnings) console.log(`⚠ ${w}`);
    for (const i of report.infos) console.log(`ℹ ${i}`);
    console.log(`Result: ${report.ok ? "READY TO DEPLOY" : "FIX THE FAILURES ABOVE"}`);
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
