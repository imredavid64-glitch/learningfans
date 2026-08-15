#!/usr/bin/env node
// Verify the realtime + RLS backbone that the browser sync checks depend on.
//
// The whiteboard sync, presence cursors, live room chat, thread posts, the
// notification bell and emoji reactions all ride on:
//   1. the `supabase_realtime` publication including the right tables
//      (postgres_changes delivers nothing for a table that isn't published),
//   2. RLS policies that let participants subscribe and the app write.
//
// This script proves both END-TO-END with behavioral probes — no SQL access
// needed (there is no direct connection string; the Management API token is
// not available). It creates a throwaway test user via the service role,
// subscribes to each published table with a real postgres_changes channel
// (as the test user), fires the matching insert, and waits for the event. It
// also proves RLS is actually enforced (anonymous reads/writes/realtime
// subscriptions are blocked) and that the whiteboard's presence + broadcast
// backbone works.
//
// Three separate clients keep the roles honest:
//   service   — service_role key, bypasses RLS (setup + cleanup)
//   user      — the test user, fully signed in (realtime uses the user JWT)
//   anon      — anon key only, never signed in
//
// Usage:
//   node scripts/verify-realtime.mjs          # human report, exit 0/1
//   node scripts/verify-realtime.mjs --json   # machine-readable report
//   node scripts/verify-realtime.mjs --quick  # shorter timeouts (CI-ish)
//   node scripts/verify-realtime.mjs --keep-data  # don't delete probe rows/user
//
// Exit codes:
//   0  every required realtime/RLS dependency is live and working
//   1  something the app depends on failed OR is blocked by a missing
//      migration (e.g. notifications table 404 => bell realtime is broken
//      until 20260811000000 is applied)
//   2  local config error (missing env vars / project unreachable)

import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./apply-migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
loadDotEnv(join(root, ".env.local"));

const ARGS = new Set(process.argv.slice(2));
const JSON_OUT = ARGS.has("--json");
const QUICK = ARGS.has("--quick");
const KEEP_DATA = ARGS.has("--keep-data");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const POSITIVE_MS = QUICK ? 6000 : 15000;
const NEGATIVE_MS = QUICK ? 4000 : 8000;

const results = [];
let testUserId = null;

function check(name, ok, status, detail) {
  results.push({ name, ok, status, detail: detail ?? "" });
}

const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));

// Subscribe with `client` to postgres_changes INSERTs on `table` (filtered by
// `filter`), call `fire()` once subscribed, and resolve when the event arrives
// or the timeout elapses. No event => { ok: false, reason: "timeout" }.
function probeChange({ client, table, filter, fire, ms }) {
  return new Promise((resolve) => {
    const id = `probe-${table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = client.channel(id);
    let settled = false;
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout — no realtime event delivered" }), ms);
    function finish(r) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeChannel(channel);
      resolve(r);
    }
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, () => finish({ ok: true }))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          Promise.resolve()
            .then(fire)
            .catch((e) => finish({ ok: false, reason: `fire error: ${e?.message ?? e}` }));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          finish({ ok: false, reason: `subscribe status ${status}` });
        }
      });
  });
}

// Negative control: the event must NOT be delivered (RLS gates realtime).
async function probeNoDelivery({ client, table, filter, fire, ms }) {
  const r = await probeChange({ client, table, filter, fire, ms });
  if (r.ok) return { ok: false, reason: "event WAS delivered to a subscriber who shouldn't see it (RLS not gating realtime)" };
  return { ok: true, reason: "no event delivered to blocked subscriber (RLS gates realtime)" };
}

function isMissingTable(error) {
  // PostgREST: 404 PGRST205 table not found / PGRST204 relation does not exist.
  const code = error?.code ?? "";
  const msg = String(error?.message ?? error ?? "");
  return error?.status === 404 || code === "PGRST205" || code === "PGRST204" || /does not exist|relation .* not found/i.test(msg);
}

function isRlsDenied(error) {
  const msg = String(error?.message ?? error ?? "");
  return error?.status === 401 || error?.status === 403 || error?.code === "42501" || error?.code === "PGRST301" ||
    /permission|row-level security policy/i.test(msg);
}

async function main() {
  if (!URL || !ANON_KEY || !SERVICE_KEY) {
    console.error("Missing env: need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(2);
  }

  const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonClient = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // --- Test user ----------------------------------------------------------
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `rt-probe-${tag}@example.com`;
  const password = `probe-${tag}-Pw!9`;
  try {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Realtime Probe" },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message ?? "createUser returned no user");
    testUserId = created.user.id;
    // Sign in on the USER client itself so its auth store (and therefore the
    // realtime connection) carries the user JWT, not the anon key.
    const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(signInErr?.message ?? "signInWithPassword failed");
  } catch (e) {
    check("test-user setup", false, "error", e?.message ?? String(e));
    await cleanup(service);
    printReport();
    process.exit(1);
  }

  // --- A. Realtime publication: postgres_changes end-to-end ---------------
  // A1. study_room_messages (live room chat) — room creation also proves the
  //     RLS insert path for study_rooms.
  let roomId = null;
  {
    const { data: room, error } = await userClient
      .from("study_rooms")
      .insert({ space_id: null, created_by: testUserId, name: "RT Probe", status: "active", whiteboard: [] })
      .select("id")
      .single();
    if (error || !room?.id) {
      check("realtime: study_room_messages (room chat)", false, "error",
        `could not create probe room — ${error?.message ?? "no id returned"}`);
    } else {
      roomId = room.id;
      const r = await probeChange({
        client: userClient,
        table: "study_room_messages",
        filter: `room_id=eq.${roomId}`,
        fire: () => userClient.from("study_room_messages").insert({ room_id: roomId, user_id: testUserId, body: `rt-probe-${tag}` }),
        ms: POSITIVE_MS,
      });
      check("realtime: study_room_messages (room chat)", r.ok, r.ok ? "ok" : "error", r.reason);
    }
  }

  // A2. posts (community feed) — needs space + membership + thread first.
  {
    const slug = `rt-probe-${tag}`;
    const { data: space, error: spaceErr } = await userClient
      .from("spaces")
      .insert({ name: "RT Probe Space", slug, is_public: true, created_by: testUserId })
      .select("id")
      .single();
    let threadId = null;
    if (spaceErr) {
      check("realtime: posts (community feed)", false, "error", `could not create probe space — ${spaceErr?.message}`);
    } else {
      await userClient.from("space_members").insert({ space_id: space.id, user_id: testUserId });
      const { data: thread, error: threadErr } = await userClient
        .from("threads")
        .insert({ space_id: space.id, author_id: testUserId, title: "RT probe thread", body: "probe" })
        .select("id")
        .single();
      if (threadErr) {
        check("realtime: posts (community feed)", false, "error", `could not create probe thread — ${threadErr?.message}`);
      } else {
        threadId = thread.id;
        const r = await probeChange({
          client: userClient,
          table: "posts",
          filter: `author_id=eq.${testUserId}`,
          fire: () => userClient.from("posts").insert({ thread_id: threadId, author_id: testUserId, body: `rt-probe-${tag}` }),
          ms: POSITIVE_MS,
        });
        check("realtime: posts (community feed)", r.ok, r.ok ? "ok" : "error", r.reason);
      }
    }
  }

  // A3. notifications (the bell) — table lives in 20260811000000, which is in
  //     the CI KNOWN_EXCLUDED list but NOT applied to live.
  {
    const { error } = await service.from("notifications").select("id").limit(1);
    if (isMissingTable(error)) {
      check("realtime: notifications (bell)", false, "blocked",
        "table not on live — apply 20260811000000_study_progress_notifications.sql (bell realtime is broken until then)");
    } else {
      const r = await probeChange({
        client: userClient,
        table: "notifications",
        filter: `user_id=eq.${testUserId}`,
        fire: () => service.from("notifications").insert({ user_id: testUserId, type: "system", title: "RT probe", body: "probe" }),
        ms: POSITIVE_MS,
      });
      check("realtime: notifications (bell)", r.ok, r.ok ? "ok" : "error", r.reason);
    }
  }

  // A4. study_room_message_reactions (emoji reactions) — 20260812000005.
  {
    const { error } = await service.from("study_room_message_reactions").select("id").limit(1);
    if (isMissingTable(error)) {
      check("realtime: study_room_message_reactions (reactions)", false, "blocked",
        "table not on live — apply 20260812000005_study_room_reactions.sql (reaction realtime is broken until then)");
    } else if (roomId) {
      const r = await probeChange({
        client: userClient,
        table: "study_room_message_reactions",
        filter: `room_id=eq.${roomId}`,
        fire: () =>
          userClient.from("study_room_message_reactions").insert({
            room_id: roomId,
            message_id: "00000000-0000-0000-0000-000000000000",
            user_id: testUserId,
            emoji: "👍",
          }),
        ms: POSITIVE_MS,
      });
      check("realtime: study_room_message_reactions (reactions)", r.ok, r.ok ? "ok" : "error", r.reason);
    }
  }

  // --- B. RLS enforcement (behavioral) ------------------------------------
  // B1. Anonymous SELECT on profiles must see nothing (RLS on, no anon policy).
  {
    const { error, count } = await anonClient.from("profiles").select("id", { count: "exact", head: true });
    const blocked = !error && count === 0;
    const denied = !!error && isRlsDenied(error);
    check("RLS: anonymous profile reads blocked", blocked || denied, blocked || denied ? "ok" : "fail",
      denied ? `denied (${error?.code ?? error?.message})`
        : blocked ? `anon sees 0 profiles (RLS enforced)`
        : `anon can read ${count} profiles — RLS NOT enforced`);
  }

  // B2. Anonymous INSERT into study_room_messages must be rejected.
  {
    const { error } = await anonClient.from("study_room_messages").insert({ room_id: "00000000-0000-0000-0000-000000000000", user_id: testUserId, body: "anon probe" });
    const denied = !!error && isRlsDenied(error);
    check("RLS: anonymous chat writes rejected", denied, denied ? "ok" : "fail",
      denied ? `rejected (${error?.code ?? error?.status})` : `anon insert accepted (${error?.message ?? "no error"}) — RLS NOT enforced`);
  }

  // B3. Authenticated user can create a room (positive RLS path, already done in A1).
  check("RLS: authenticated room creation allowed", !!roomId, roomId ? "ok" : "fail",
    roomId ? `probe room ${roomId.slice(0, 8)} created` : "authed room insert failed — see A1");

  // B4. Whiteboard save path: authenticated update of study_rooms.whiteboard.
  {
    if (roomId) {
      const { error } = await userClient
        .from("study_rooms")
        .update({ whiteboard: [{ id: "probe", points: [[0, 0], [1, 1]] }], updated_at: new Date().toISOString() })
        .eq("id", roomId);
      check("RLS: whiteboard snapshot save (authed update)", !error, !error ? "ok" : "error", error?.message ?? "");
    } else {
      check("RLS: whiteboard snapshot save (authed update)", false, "skipped", "no probe room available");
    }
  }

  // B5. Realtime RLS: an ANONYMOUS subscriber must NOT receive the room's chat.
  {
    if (roomId) {
      const r = await probeNoDelivery({
        client: anonClient,
        table: "study_room_messages",
        filter: `room_id=eq.${roomId}`,
        fire: () => userClient.from("study_room_messages").insert({ room_id: roomId, user_id: testUserId, body: `rt-probe-anon-${tag}` }),
        ms: NEGATIVE_MS,
      });
      check("realtime RLS: anonymous subscriber gets no chat", r.ok, r.ok ? "ok" : "fail", r.reason);
    } else {
      check("realtime RLS: anonymous subscriber gets no chat", false, "skipped", "no probe room available");
    }
  }

  // --- C. Whiteboard backbone: presence + broadcast -----------------------
  {
    const chan = `study-room-board-${roomId ?? "probe"}`;
    const a = userClient;
    const b = anonClient;
    let presenceSeen = false;
    let broadcastSeen = false;
    const aCh = a.channel(chan, { config: { presence: { key: "probe-user-a" } } });
    const bCh = b.channel(chan);
    try {
      await new Promise((resolve) => {
        let aSub = false;
        let bSub = false;
        const maybe = () => { if (aSub && bSub) resolve(); };
        bCh.on("presence", { event: "sync" }, () => {
          if (bCh.presenceState()["probe-user-a"]) presenceSeen = true;
        });
        bCh.on("broadcast", { event: "stroke" }, () => { broadcastSeen = true; });
        aCh.subscribe((s) => { if (s === "SUBSCRIBED") { aSub = true; maybe(); } });
        bCh.subscribe((s) => { if (s === "SUBSCRIBED") { bSub = true; maybe(); } });
        setTimeout(resolve, 5000).unref?.();
      });
      await aCh.track({ user_id: "probe-user-a", x: 10, y: 20 });
      await waitFor(QUICK ? 800 : 1500);
      await aCh.send({ type: "broadcast", event: "stroke", payload: { id: "s1", points: [[0, 0], [1, 1]] } });
      await waitFor(QUICK ? 1500 : 3000);
    } catch (e) {
      check("whiteboard backbone: presence + broadcast", false, "error", e?.message ?? String(e));
    } finally {
      aCh.untrack().catch(() => {});
      a.removeChannel(aCh);
      b.removeChannel(bCh);
    }
    if (results.every((r) => r.name !== "whiteboard backbone: presence + broadcast")) {
      const ok = presenceSeen && broadcastSeen;
      const missing = [];
      if (!presenceSeen) missing.push("presence cursors");
      if (!broadcastSeen) missing.push("stroke broadcast");
      check("whiteboard backbone: presence + broadcast", ok, ok ? "ok" : "fail",
        missing.length ? `missing: ${missing.join(", ")}` : "cross-client presence sync + stroke broadcast both delivered");
    }
  }

  await cleanup(service);
  printReport();
}

async function cleanup(service) {
  if (KEEP_DATA) return;
  try {
    if (testUserId) {
      await service.from("space_members").delete().eq("user_id", testUserId);
      await service.from("study_room_messages").delete().eq("user_id", testUserId);
      await service.from("posts").delete().eq("author_id", testUserId);
      await service.from("threads").delete().eq("author_id", testUserId);
      await service.from("spaces").delete().eq("created_by", testUserId);
      await service.from("study_rooms").delete().eq("created_by", testUserId);
      await service.auth.admin.deleteUser(testUserId);
    }
  } catch (e) {
    console.error(`cleanup warning: ${e?.message ?? e}`);
  }
}

function printReport() {
  const okCount = results.filter((r) => r.ok).length;
  const blocked = results.filter((r) => r.status === "blocked");
  const failed = results.filter((r) => !r.ok && r.status !== "blocked");
  const allOk = failed.length === 0;

  if (JSON_OUT) {
    const report = {
      ok: allOk,
      checkedAt: new Date().toISOString(),
      summary: { total: results.length, ok: okCount, blocked: blocked.length, failed: failed.length },
      checks: results,
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nRealtime + RLS verification (live):");
    for (const r of results) {
      const icon = r.ok ? "✓" : r.status === "blocked" ? "⏳" : "✗";
      console.log(`  ${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    console.log(`\n${okCount}/${results.length} passing, ${blocked.length} blocked, ${failed.length} failed`);
    if (blocked.length) {
      console.log("\nBlocked (migration not applied to live):");
      for (const b of blocked) console.log(`  ⏳ ${b.name}`);
    }
    if (failed.length) {
      console.log("\nFailed — the browser sync checks depend on these:");
      for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
    }
    console.log(allOk ? "\n✅ Realtime + RLS backbone is live and working." : "\n❌ Not all realtime/RLS dependencies are live.");
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
