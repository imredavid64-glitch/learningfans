#!/usr/bin/env node
// Audit the excluded migrations against the live database — COMPLETE surface,
// with correct RPC semantics.
//
// The CI batch check trusts that the excluded migrations were "applied long
// ago" — this script replaces that assumption with evidence. It parses each
// excluded migration file and probes EVERY object it creates against live:
//
//   tables  — presence in the PostgREST OpenAPI spec (definitive, one request)
//   columns — REST SELECT col (42703 = missing column)
//   rpcs    — presence in the OpenAPI spec under /rpc/{name}. PostgREST's
//             schema cache is the ground truth for callable functions; a bare
//             no-arg rpc() call returns PGRST202 for ANY function with named
//             params, so it can NOT be used as an existence check.
//   triggers— trigger functions (returns trigger) are NEVER exposed via
//             PostgREST, so spec-absence is expected; they're verified via the
//             table their trigger is attached to.
//   buckets — storage GET
//
// History: the 2026-08-15 run found 9 of the then-17 excluded migrations were
// NOT applied on live. They were made idempotent and folded into
// pending_apply.sql — after the next apply they should read APPLIED.
//
// Usage:
//   node scripts/audit-excluded-migrations.mjs          # human report
//   node scripts/audit-excluded-migrations.mjs --json   # machine report
//
// Exit codes: 0 always (it's a report), 2 on config error.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./apply-migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
loadDotEnv(join(root, ".env.local"));

const JSON_OUT = process.argv.includes("--json");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The full excluded set — both the 8 still-excluded (genuinely applied) and
// the 9 folded into the batch after the 2026-08-15 audit.
const EXCLUDED = [
  { file: "20260520100000_initial_schema.sql", reason: "base schema" },
  { file: "20260524100000_profile_insert_policy.sql", reason: "policy-only" },
  { file: "20260528100000_profile_insert_policy_only.sql", reason: "policy-only" },
  { file: "20260715000000_security.sql", reason: "security hardening" },
  { file: "20260720000000_archive_security.sql", reason: "archive vault (get_db_size runs in MAIN DB)" },
  { file: "20260727000000_meetings.sql", reason: "meetings" },
  { file: "20260727000001_space_passwords.sql", reason: "space passwords" },
  { file: "20260728000000_multi_tenant_schools.sql", reason: "multi-tenant schools" },
  { file: "20260807000000_profanity_escalation.sql", reason: "profanity escalation" },
  { file: "20260811000000_study_progress_notifications.sql", reason: "notifications + XP/stats" },
  // Trigger-only migration: notify_new_post inserts into notifications, so its
  // live state is derived from that dependency (probeable via REST).
  { file: "20260812000001_reply_notifications.sql", reason: "reply notifications", dependsOn: { kind: "table", table: "notifications" } },
  { file: "20260812000002_schedule_event_reminders.sql", reason: "schedule event reminders" },
  { file: "20260812000003_push_subscriptions.sql", reason: "web push" },
  { file: "20260812000004_study_rooms.sql", reason: "study rooms" },
  { file: "20260812000005_study_room_reactions.sql", reason: "emoji reactions" },
  { file: "20260812000006_community_rules.sql", reason: "community rules + announcements" },
  { file: "20260812000007_thread_votes.sql", reason: "thread upvotes/downvotes" },
];

const MIGRATIONS_DIR = join(root, "supabase", "migrations");

// Parse a migration file into the complete object surface it creates:
//   tables, columns (table -> Set), rpcs, trigger fns (fn -> target table),
//   buckets. Comment lines are skipped so the archived_records comment block
//   in the archive migration doesn't pollute the main-DB probe list.
function extractSurface(sql) {
  const tables = new Set();
  const columns = new Map();
  const rpcs = new Set();
  const triggerFns = new Map(); // function name -> target table
  const buckets = new Set();

  // Strip comment lines FIRST (they can contain CREATE TABLE in the archive
  // migration) — a function body ($$ … $$) can span many lines, so track blocks.
  const codeLines = sql.split("\n").filter((l) => !l.trim().startsWith("--"));
  const text = codeLines.join("\n");

  const tableRe = /create table (?:if not exists )?public\.([a-z_]+)/gi;
  for (const m of text.matchAll(tableRe)) tables.add(m[1].toLowerCase());

  const fnRe = /create or replace function public\.([a-z_]+)/gi;
  const fnStarts = [...text.matchAll(fnRe)].map((m) => m.index);
  for (const idx of fnStarts) {
    const name = text.slice(idx).match(/public\.([a-z_]+)/i)[1];
    rpcs.add(name);
    // Signature = from the name to the body opener ($$ or as $$).
    const bodyRe = /(?:\b|as )\$\$/;
    const bodyMatch = text.slice(idx).match(bodyRe);
    const sig = bodyMatch ? text.slice(idx, idx + bodyMatch.index) : text.slice(idx, idx + 400);
    if (/returns trigger/i.test(sig)) triggerFns.set(name, null);
  }

  // Trigger target tables: create trigger … on public.X … execute function public.fn
  const trigRe = /create trigger [a-z_]+[\s\S]*?on public\.([a-z_]+)[\s\S]*?execute function public\.([a-z_]+)/gi;
  for (const m of text.matchAll(trigRe)) {
    triggerFns.set(m[2].toLowerCase(), m[1].toLowerCase());
  }

  // Columns: alter table public.X ( … add column [if not exists] C …)
  const alterRe = /alter table public\.([a-z_]+)([\s\S]*?)(?:;|create |alter table|$)/gi;
  for (const m of text.matchAll(alterRe)) {
    const table = m[1].toLowerCase();
    const colRe = /add column (?:if not exists )?([a-z_]+)/gi;
    for (const cm of m[2].matchAll(colRe)) {
      if (!columns.has(table)) columns.set(table, new Set());
      columns.get(table).add(cm[1].toLowerCase());
    }
  }

  // Buckets: insert into storage.buckets … values ('id', …), ('id2', …)
  // — match every row's first value inside each bucket-insert block.
  const bucketBlockRe = /insert into storage\.buckets[\s\S]*?values([\s\S]*?);/gi;
  for (const m of text.matchAll(bucketBlockRe)) {
    const rowRe = /\(\s*'([a-z_-]+)'/gi;
    for (const rm of m[1].matchAll(rowRe)) buckets.add(rm[1].toLowerCase());
  }

  return { tables: [...tables].sort(), columns, rpcs: [...rpcs].sort(), triggerFns, buckets: [...buckets].sort() };
}

function toTargets(surface, entry) {
  const targets = [];
  for (const t of surface.tables) targets.push({ kind: "table", table: t, name: t });
  for (const [table, cols] of surface.columns) {
    for (const c of cols) targets.push({ kind: "column", table, column: c, name: `${table}.${c}` });
  }
  for (const f of surface.rpcs) {
    // .has(), not truthiness — signature-classified triggers store a null value.
    const isTrig = surface.triggerFns.has(f);
    targets.push({ kind: isTrig ? "trigger" : "rpc", rpc: f, table: surface.triggerFns.get(f), name: `${f}()` });
  }
  for (const b of surface.buckets) targets.push({ kind: "bucket", bucket: b, name: `bucket:${b}` });
  // Dependency override for trigger-only migrations (notify_new_post → notifications):
  // if the migration creates no probeable object of its own, judge it by its
  // dependency's live state.
  const hasProbeable = targets.some((t) => t.kind !== "trigger");
  if (entry.dependsOn && !hasProbeable) {
    targets.push({ ...entry.dependsOn, name: `depends-on:${entry.dependsOn.table}` });
  }
  return targets;
}

async function main() {
  if (!URL || !SERVICE_KEY) {
    console.error("Missing env: need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(2);
  }
  const restBase = `${URL.replace(/\/$/, "")}/rest/v1`;
  const storageBase = `${URL.replace(/\/$/, "")}/storage/v1`;
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  // Fetch the PostgREST OpenAPI spec once — the definitive schema-cache truth
  // for tables and callable RPCs.
  const specRes = await fetch(`${restBase}/`, { headers }).catch(() => null);
  const spec = specRes && specRes.ok ? await specRes.json().catch(() => null) : null;
  const specPaths = new Set(spec ? Object.keys(spec.paths ?? {}) : []);
  // Table paths are exactly "/<table>"; RPC paths are "/rpc/<fn>".
  const specTables = new Set([...specPaths].filter((p) => /^\/[a-z_]+$/.test(p)).map((p) => p.slice(1)));
  const specRpcs = new Set([...specPaths].filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)));

  async function probeOne(target) {
    if (target.kind === "table") {
      const inSpec = specTables.has(target.table);
      // cross-check via a real REST select (composite-PK safe with select=*)
      const { error } = await rest().from(target.table).select("*").limit(1);
      const restLive = !error;
      return { live: inSpec || restLive, detail: inSpec ? "in OpenAPI spec" : restLive ? "REST ok" : error ? `${error.code ?? error.status}` : "" };
    }
    if (target.kind === "column") {
      const { error } = await rest().from(target.table).select(target.column).limit(1);
      // 42703 = column missing; PGRST205/404 = the whole table is missing.
      const missing =
        !!error &&
        (error.code === "42703" ||
          error.code === "PGRST205" ||
          error.code === "PGRST204" ||
          error.status === 404);
      return { live: !missing, detail: error && !missing ? `${error.code ?? error.status}` : missing ? "missing" : "exists" };
    }
    if (target.kind === "rpc") {
      // Spec presence is definitive for callable functions; PGRST202 from a
      // bare call is NOT evidence of absence (named-param functions reject it).
      const inSpec = specRpcs.has(target.rpc);
      return { live: inSpec, detail: inSpec ? "in OpenAPI spec" : "NOT in OpenAPI spec — callable function missing" };
    }
    if (target.kind === "trigger") {
      // Trigger functions are NEVER exposed via PostgREST and cannot be called
      // through REST. They inherit the migration's verdict, so this probe is
      // informational only (does not flip a migration to missing/partial on
      // its own).
      return { live: true, note: true, detail: "trigger fn — not REST-probeable; verified via its migration's tables" };
    }
    if (target.kind === "bucket") {
      const res = await fetch(`${storageBase}/bucket/${target.bucket}`, { headers, redirect: "manual" }).catch(() => null);
      return { live: res?.status === 200, detail: res ? `HTTP ${res.status}` : "network error" };
    }
    return { live: false, detail: `unknown kind ${target.kind}` };
  }

  let restClient = null;
  function rest() {
    if (!restClient) {
      restClient = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
    }
    return restClient;
  }

  const results = [];
  for (const entry of EXCLUDED) {
    const sql = readFileSync(join(MIGRATIONS_DIR, entry.file), "utf8");
    const surface = extractSurface(sql);
    const targets = toTargets(surface, entry);

    const probes = [];
    for (const target of targets) {
      const r = await probeOne(target);
      probes.push({ ...target, ...r });
    }
    // Verdict is driven ONLY by probeable objects (tables/columns/RPCs/
    // buckets); informational trigger-fn probes don't count either way.
    // Verdict is driven ONLY by probeable objects (tables/columns/RPCs/buckets);
    // informational trigger-fn probes never count either way.
    const probeable = probes.filter((p) => !p.note);
    const missing = probeable.filter((p) => !p.live);
    let verdict;
    if (probeable.length === 0 && targets.length > 0) verdict = "policy-only";
    else if (missing.length === 0) verdict = "APPLIED";
    else if (probeable.length > 0 && missing.length === probeable.length) verdict = "MISSING";
    else verdict = "PARTIAL";
    results.push({ migration: entry.file, reason: entry.reason, verdict, probes });
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  } else {
    console.log("Excluded-migration audit against live (complete surface):");
    for (const r of results) {
      const mark = r.verdict === "APPLIED" ? "✓" : r.verdict === "policy-only" ? "·" : r.verdict === "MISSING" ? "✗ MISSING" : "◐ PARTIAL";
      console.log(`  ${mark} ${r.migration} (${r.reason})`);
      for (const p of r.probes) {
        console.log(`       ${p.live ? "✓" : "✗"} ${p.kind} ${p.name} (${p.detail})`);
      }
    }
    const notApplied = results.filter((r) => r.verdict === "MISSING" || r.verdict === "PARTIAL");
    console.log(`\n${results.length - notApplied.length} applied / ${results.length} total; ${notApplied.length} NOT fully applied on live.`);
    for (const m of notApplied) console.log(`  ⚠️  ${m.migration} — ${m.verdict}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
