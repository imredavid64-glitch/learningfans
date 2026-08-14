#!/usr/bin/env node
// CI check: keep supabase/migrations/pending_apply.sql from going stale.
//
// pending_apply.sql is the single-paste batch that enables every new feature on
// the live database. This check fails when:
//   1. a migration file has no section in pending_apply.sql (new migrations
//      must be folded in so they actually get applied), or
//   2. a sectioned migration's SQL content is missing from pending_apply.sql
//      (the section went stale after the file was edited), or
//   3. a section header references a migration file that no longer exists.
//
// Migrations that were applied before the batch was consolidated (base schema,
// legacy features, the archive-vault schema) are listed in KNOWN_EXCLUDED with
// a reason. Add NEW migrations to pending_apply.sql — not to this list.
//
// Dependency-free on purpose: CI runs it with plain `node`, no install needed.
//
// Usage: node scripts/check-migration-batch.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const MIGRATIONS_DIR = join(root, "supabase", "migrations");
const BATCH_FILE = "pending_apply.sql";

// Migrations intentionally NOT folded into pending_apply.sql, with a reason.
const KNOWN_EXCLUDED = new Map([
  ["20260520100000_initial_schema.sql", "base schema, applied at project creation"],
  ["20260524100000_profile_insert_policy.sql", "legacy, superseded by the _only variant"],
  ["20260528100000_profile_insert_policy_only.sql", "legacy, applied long ago"],
  ["20260715000000_security.sql", "legacy, applied long ago"],
  ["20260720000000_archive_security.sql", "runs in the ARCHIVE project, not the main DB"],
  ["20260727000000_meetings.sql", "legacy, applied long ago"],
  ["20260727000001_space_passwords.sql", "legacy, applied long ago"],
  ["20260728000000_multi_tenant_schools.sql", "legacy, applied long ago"],
  ["20260807000000_profanity_escalation.sql", "legacy, applied long ago"],
  ["20260811000000_study_progress_notifications.sql", "legacy, applied long ago"],
  ["20260812000001_reply_notifications.sql", "legacy, applied long ago"],
  ["20260812000002_schedule_event_reminders.sql", "legacy, applied long ago"],
  ["20260812000003_push_subscriptions.sql", "legacy, applied long ago"],
  ["20260812000004_study_rooms.sql", "legacy, applied long ago"],
  ["20260812000005_study_room_reactions.sql", "legacy, applied long ago"],
  ["20260812000006_community_rules.sql", "legacy, applied long ago"],
  ["20260812000007_thread_votes.sql", "legacy, applied long ago"],
]);

// Strip comments and whitespace for a structure-only comparison. A heuristic —
// fine for CI guarding; string literals are preserved byte-identically between
// a section and its source file, so any whitespace/comment churn cancels out.
function normalize(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, "");
}

function fail(problems) {
  for (const p of problems) console.error(p);
  console.error(`\n❌ ${problems.length} problem(s) with ${BATCH_FILE}.`);
  process.exit(1);
}

function main() {
  const batch = readFileSync(join(MIGRATIONS_DIR, BATCH_FILE), "utf8");
  const batchNorm = normalize(batch);

  const sections = [...batch.matchAll(/-- ============ ([0-9A-Za-z_.-]+\.sql) ============/g)].map(
    (m) => m[1],
  );
  const sectionSet = new Set(sections);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f !== BATCH_FILE && f !== "combined.sql")
    .sort();

  const problems = [];

  // 1) Section headers must point at real files (catches typos / deleted files).
  for (const name of sections) {
    if (!files.includes(name)) {
      problems.push(`✗ ${BATCH_FILE} has a section for ${name}, but that file doesn't exist.`);
    }
  }

  for (const name of files) {
    const excluded = KNOWN_EXCLUDED.get(name);

    if (excluded) {
      if (sectionSet.has(name)) {
        console.log(`ℹ  ${name} is in KNOWN_EXCLUDED but has a section — fine, consider removing it from the list.`);
      }
      continue;
    }

    if (!sectionSet.has(name)) {
      problems.push(
        `✗ ${name} has no section in ${BATCH_FILE}. Fold it in (paste the file into the batch with a\n` +
          `    "-- ============ ${name} ============" header). Do NOT add it to KNOWN_EXCLUDED.`,
      );
      continue;
    }

    const content = normalize(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
    if (!content || !batchNorm.includes(content)) {
      problems.push(
        `✗ ${name} has a section in ${BATCH_FILE}, but the section content is stale — the file was\n` +
          `    edited after folding. Update the matching section in ${BATCH_FILE}.`,
      );
    }
  }

  if (problems.length) fail(problems);

  console.log(`✓ ${BATCH_FILE} is in sync: all ${files.length - KNOWN_EXCLUDED.size} batch migrations folded in, ${KNOWN_EXCLUDED.size} excluded.`);
}

main();
