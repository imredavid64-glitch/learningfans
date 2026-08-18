#!/usr/bin/env node
// Apply a Supabase migration SQL file to a live project via the Management API,
// so migrations never need a manual SQL-editor paste again.
//
// Requires a Supabase personal access token (an sbp_... JWT from
// https://supabase.com/dashboard/account/tokens) exposed as SUPABASE_ACCESS_TOKEN.
// The token is read from process.env or .env.local (see loadDotEnv).
//
// Usage:
//   node scripts/apply-migrations.mjs                     # apply pending_apply.sql
//   node scripts/apply-migrations.mjs --dry-run           # print statements, send nothing
//   node scripts/apply-migrations.mjs --file path.sql     # apply a different file
//   node scripts/apply-migrations.mjs --ref abcdefghijkl  # target a specific project ref
//   node scripts/apply-migrations.mjs --stop-on-error     # halt at the first failure
//   node scripts/apply-migrations.mjs --single            # send the whole file as one query
//   node scripts/apply-migrations.mjs --self-test         # verify the statement splitter
//   node scripts/apply-migrations.mjs --verify            # apply, then re-probe live & report what flipped on
//
// The script splits the file into individual statements (respecting quotes,
// comments, and $$...$$ function bodies) and POSTs each to the Management API
// /v1/projects/{ref}/database/query endpoint. The migration batch is idempotent,
// so a partial run can simply be re-run to completion.

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const API = "https://api.supabase.com/v1";
const DEFAULT_FILE = "supabase/migrations/pending_apply.sql";

const HELP = `apply-migrations.mjs — apply a migration SQL file via the Supabase Management API

Options:
  --file <path>      SQL file to apply (default: ${DEFAULT_FILE})
  --ref <ref>        Supabase project ref (default: parsed from NEXT_PUBLIC_SUPABASE_URL)
  --dry-run          Split + print statements without sending anything
  --single           Send the entire file as one query instead of statement-by-statement
  --stop-on-error    Halt at the first failed statement (default: continue + summarize)
  --self-test        Verify the splitter round-trips the file (no network)
  --verify           Apply, then re-probe live via the launch smoke test and
                     report which migrations flipped on (still missing → exit 1)
  -h, --help         Show this help

Env:
  SUPABASE_ACCESS_TOKEN  Required. Personal access token (sbp_...) from
                         https://supabase.com/dashboard/account/tokens
  NEXT_PUBLIC_SUPABASE_URL  Used to infer the project ref when --ref is omitted.
`;

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    ref: undefined,
    dryRun: false,
    single: false,
    stopOnError: false,
    selfTest: false,
    verify: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i];
    else if (a === "--ref") args.ref = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--single") args.single = true;
    else if (a === "--stop-on-error") args.stopOnError = true;
    else if (a === "--self-test") args.selfTest = true;
    else if (a === "--verify") args.verify = true;
    else if (a === "--help" || a === "-h") {
      console.log(HELP);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}\n`);
      console.error(HELP);
      process.exit(2);
    }
  }
  return args;
}

// Load KEY=VALUE pairs from a dotenv file without overriding already-set env.
export function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// If sql[i] starts a dollar-quoted string, return its opening delimiter
// ("$$", "$tag$", ...), otherwise null.
function readDollarDelim(sql, i) {
  if (sql[i] !== "$") return null;
  let j = i + 1;
  while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
  if (j < sql.length && sql[j] === "$") return sql.slice(i, j + 1);
  return null;
}

function lineAt(sql, offset) {
  return sql.slice(0, offset).split("\n").length;
}

// Heuristic: does this text contain only comments/whitespace? (Used to skip
// comment-only chunks, not a full parse.)
function isOnlyComments(s) {
  const noBlock = s.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/--[^\n]*/g, "");
  return noLine.trim().length === 0;
}

// Split a Postgres script into statements, respecting:
//   -- line comments, /* ... */ block comments (nested),
//   '...' strings (with '' and backslash escapes), "..." identifiers,
//   and $$...$$ / $tag$...$tag$ dollar-quoted bodies.
// Returns [{ sql, line }].
export function splitStatements(sql) {
  const out = [];
  let buf = "";
  let bufStart = 0;
  let i = 0;
  const n = sql.length;

  const flush = (nextStart) => {
    const stmt = buf.trim();
    if (stmt && !isOnlyComments(stmt)) {
      out.push({ sql: stmt, line: lineAt(sql, bufStart) });
    }
    buf = "";
    bufStart = nextStart;
  };

  while (i < n) {
    const c = sql[i];
    const nx = sql[i + 1];

    // Line comment
    if (c === "-" && nx === "-") {
      while (i < n && sql[i] !== "\n") {
        buf += sql[i];
        i++;
      }
      continue;
    }

    // Block comment (nesting-safe)
    if (c === "/" && nx === "*") {
      let depth = 0;
      do {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          buf += "/*";
          i += 2;
          depth++;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          buf += "*/";
          i += 2;
          depth--;
        } else {
          buf += sql[i];
          i++;
        }
      } while (i < n && depth > 0);
      continue;
    }

    // Single-quoted string
    if (c === "'") {
      buf += c;
      i++;
      while (i < n) {
        if (sql[i] === "\\" && i + 1 < n) {
          buf += sql[i] + sql[i + 1];
          i += 2;
          continue;
        }
        if (sql[i] === "'" && sql[i + 1] === "'") {
          buf += "''";
          i += 2;
          continue;
        }
        buf += sql[i];
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Double-quoted identifier
    if (c === '"') {
      buf += c;
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          buf += '""';
          i += 2;
          continue;
        }
        buf += sql[i];
        if (sql[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Dollar-quoted body
    const delim = readDollarDelim(sql, i);
    if (delim) {
      const close = sql.indexOf(delim, i + delim.length);
      if (close === -1) {
        buf += sql.slice(i);
        i = n;
      } else {
        buf += sql.slice(i, close + delim.length);
        i = close + delim.length;
      }
      continue;
    }

    // Statement terminator
    if (c === ";") {
      flush(i + 1);
      i++;
      continue;
    }

    buf += c;
    i++;
  }

  flush(n);
  return out;
}

// Strip comments and whitespace so two SQL texts can be compared structurally.
// (Whitespace is insignificant in SQL outside of string literals, and string
// literals are preserved byte-identically by the splitter on both sides.)
function normalizeSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, "");
}

async function runQuery(token, ref, query) {
  const res = await fetch(`${API}/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function refFromUrl(url) {
  const m = (url || "").match(/^https?:\/\/([^.]+)\./);
  return m ? m[1] : undefined;
}

async function selfTest(filePath) {
  const sql = readFileSync(filePath, "utf8");
  const statements = splitStatements(sql);
  const rejoined = statements.map((s) => s.sql).join(";");
  // The splitter consumes each statement's trailing ';' as its boundary and
  // join() only re-adds separators between statements, so strip the original's
  // final terminator before comparing.
  const a = normalizeSql(sql).replace(/;$/, "");
  const b = normalizeSql(rejoined);

  console.log(`Split ${basename(filePath)} into ${statements.length} statements.`);
  console.log(`Round-trip normalized match: ${a === b ? "PASS" : "FAIL"}`);
  if (a !== b) {
    // Show the first divergence for debugging.
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    console.error(`  first difference around char ${i}:`);
    console.error(`    original: …${a.slice(Math.max(0, i - 40), i + 40)}…`);
    console.error(`    rejoined: …${b.slice(Math.max(0, i - 40), i + 40)}…`);
    process.exit(1);
  }
  process.exit(0);
}

// Run the launch smoke test in JSON mode and return its per-migration results
// ({ id → { ok, ... } }) or null if the probe couldn't run. The probe exits 1
// when migrations are missing, so stdout is captured even on non-zero exits.
export function runSmokeProbe() {
  const run = () =>
    execFileSync("node", ["scripts/launch-smoke-test.mjs", "--json"], {
      encoding: "utf8",
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
  try {
    return JSON.parse(run()).migrations;
  } catch (err) {
    const stdout = (err && err.stdout && err.stdout.toString()) || "";
    try {
      return JSON.parse(stdout).migrations;
    } catch {
      return null;
    }
  }
}

// Diff the before/after probe results; returns true when every migration is live.
export function reportVerify(before, after) {
  console.log("\n=== Verify after apply (live smoke test) ===");
  if (!before || !after) {
    console.log("⚠  Could not run the smoke-test probe — check NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
    return false;
  }
  const ids = Object.keys(after);
  const beforeOk = ids.filter((id) => before[id]?.ok).length;
  const afterOk = ids.filter((id) => after[id]?.ok).length;
  console.log(`Migrations live: ${beforeOk}/${ids.length} → ${afterOk}/${ids.length}`);

  const flipped = ids.filter((id) => !before[id]?.ok && after[id]?.ok);
  const stillMissing = ids.filter((id) => !after[id]?.ok);
  if (flipped.length) {
    console.log(`Flipped on (${flipped.length}):`);
    for (const id of flipped) console.log(`  ✓ ${id}`);
  } else {
    console.log("Flipped on: (none)");
  }
  if (stillMissing.length) {
    console.log(`Still missing (${stillMissing.length}):`);
    for (const id of stillMissing) console.log(`  ✗ ${id}`);
  } else {
    console.log("Still missing: none — every batch migration is live! 🎉");
  }
  return stillMissing.length === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotEnv(join(root, ".env.local"));

  const filePath = join(root, args.file);
  if (!existsSync(filePath)) {
    console.error(`SQL file not found: ${filePath}`);
    process.exit(1);
  }

  if (args.selfTest) {
    await selfTest(filePath);
    return;
  }

  const sql = readFileSync(filePath, "utf8");
  const statements = splitStatements(sql);
  const ref = args.ref || refFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  console.log(`File: ${args.file} (${statements.length} statements)`);
  console.log(`Project: ${ref || "(unknown — pass --ref or set NEXT_PUBLIC_SUPABASE_URL)"}`);

  if (args.dryRun) {
    if (args.verify) console.log("ℹ  --verify is ignored in dry-run mode (nothing is applied).");
    statements.forEach((s, i) => {
      console.log(`\n-- [${i + 1}] line ${s.line}\n${s.sql};`);
    });
    console.log(`\nDry run complete — ${statements.length} statements, nothing sent.`);
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "\nSUPABASE_ACCESS_TOKEN is not set. Create one at\n" +
        "https://supabase.com/dashboard/account/tokens and add it to .env.local:\n\n" +
        "  SUPABASE_ACCESS_TOKEN=sbp_...\n",
    );
    process.exit(1);
  }
  if (token.length < 20) {
    console.error("SUPABASE_ACCESS_TOKEN looks invalid (too short). Expected an sbp_... JWT.");
    process.exit(1);
  }
  if (!ref) {
    console.error("Could not determine project ref. Pass --ref or set NEXT_PUBLIC_SUPABASE_URL.");
    process.exit(1);
  }

  const verifyBefore = args.verify ? runSmokeProbe() : null;

  if (args.single) {
    console.log("Sending entire file as a single query…");
    const { ok, status, text } = await runQuery(token, ref, sql);
    if (ok) {
      console.log("✓ Applied as a single query.");
      if (args.verify && !reportVerify(verifyBefore, runSmokeProbe())) process.exit(1);
      return;
    }
    console.error(`✗ Single-query apply failed (HTTP ${status}): ${text.slice(0, 400)}`);
    console.error("Falling back to statement-by-statement mode.\n");
  }

  let ok = 0;
  const failures = [];
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    const firstLine = s.sql.split("\n")[0].slice(0, 72);

    // The Management API rate-limits (~120 req/min); a 429 gets a backoff
    // retry (idempotent batch makes retries safe), then the base delay keeps
    // the steady-state well under the cap.
    let attempt = 0;
    let result = null;
    while (attempt < 3) {
      result = await runQuery(token, ref, s.sql);
      if (result.status !== 429) break;
      attempt += 1;
      const waitMs = 1000 * 2 ** attempt; // 2s, 4s
      console.warn(`  ⏳ HTTP 429 (rate limit) on [${i + 1}] — retrying in ${waitMs}ms…`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    const { ok: success, status, text } = result;

    if (success) {
      ok++;
      console.log(`  ✓ [${String(i + 1).padStart(2)}] ${firstLine}`);
    } else {
      failures.push({ line: s.line, firstLine, status, text });
      console.error(`  ✗ [${String(i + 1).padStart(2)}] (line ${s.line}) HTTP ${status} — ${firstLine}`);
      if (text && text.length > 1) console.error(`      ${text.slice(0, 300)}`);
      if (args.stopOnError) break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone: ${ok} ok, ${failures.length} failed.`);
  if (failures.length) {
    console.log("Failed statements (the batch is idempotent — re-run to finish):");
    for (const f of failures) {
      console.log(`  line ${f.line}: ${f.firstLine}`);
    }
  }

  const allLive = args.verify ? reportVerify(verifyBefore, runSmokeProbe()) : true;
  if (failures.length || !allLive) process.exit(1);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
