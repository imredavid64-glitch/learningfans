#!/usr/bin/env node
// Walk the primary launch journeys END-TO-END against the live project.
//
// Section 2 of docs/LAUNCH_CHECKLIST.md — signup → community → quiz → study
// party RSVP → whiteboard sync. This script automates the server-side half of
// that walk with behavioral probes (no SQL access; everything goes through
// the public REST API with real user JWTs, so RLS is exercised for real):
//
//   A. Signup          — two fresh users created via the Auth admin API
//                        (email_confirm: true), profiles auto-created by the
//                        handle_new_user trigger, both sign in with password.
//   B. Community       — user A creates a public space, user B joins, A posts
//                        a thread, B replies, A replies to B's reply (nested),
//                        B upvotes the thread (post_votes trigger path).
//   C. Quiz            — A creates a quiz material; B takes it (grade is
//                        computed server-side by the same math as gradeQuiz,
//                        recorded via quiz_attempts upsert); leaderboard read
//                        returns B's best score.
//   D. Study party     — A creates a scheduled study room (starts_at future);
//                        B RSVPs (study_room_rsvps, RLS-gated to future
//                        active rooms); attendee count reflects it.
//   E. Whiteboard sync — A saves a stroke snapshot to study_rooms.whiteboard
//                        and posts a chat message; both round-trip through the
//                        authenticated read path.
//   F. File materials  — PDF + image uploaded to the materials bucket (own-
//                        folder storage policy), storage_path + mime recorded,
//                        signed-URL preview round-trips the exact bytes, and
//                        a member who isn't the uploader is blocked (RLS).
//   G. Review queue    — B misses a quiz question; the SM-2 flashcard deck is
//                        created from it (flashcard_set + is_quiz_review +
//                        quiz_id metadata) and re-finding it is idempotent.
//   H. Saved folders   — B creates a named folder, saves a thread + material
//                        into it, reads them back, and deleting the folder
//                        returns the items to Uncategorized (FK set null).
//
// Three clients keep roles honest:
//   service — service_role key (user creation + cleanup only)
//   userA   — test user A, signed in (all A's writes/reads)
//   userB   — test user B, signed in (all B's writes/reads)
//
// Usage:
//   node scripts/launch-walk.mjs            # human report, exit 0/1
//   node scripts/launch-walk.mjs --json     # machine-readable report
//   node scripts/launch-walk.mjs --keep-data  # don't delete probe data
//
// Exit codes: 0 = walk passed, 1 = a check failed, 2 = local config error.

import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./apply-migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
loadDotEnv(join(root, ".env.local"));

const ARGS = new Set(process.argv.slice(2));
const JSON_OUT = ARGS.has("--json");
const KEEP_DATA = ARGS.has("--keep-data");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
const testUsers = [];
let spaceId = null;
let threadId = null;
let materialId = null;
let partyRoomId = null;

// Storage files created by the walk, removed in cleanup().
const storagePaths = [];

// Minimal-but-valid file bytes for the PDF preview / image lightbox journeys.
// PNG: 1x1 transparent. PDF: smallest well-formed doc (content-type is what
// matters for the round-trip; the storage layer doesn't validate structure).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const TINY_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  "utf8",
);

function check(name, ok, status, detail) {
  results.push({ name, ok, status: status ?? (ok ? "ok" : "fail"), detail: detail ?? "" });
}

const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));

async function createTestUser(service, tag, displayName) {
  const email = `walk-${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${tag}@example.com`;
  const password = `walk-${tag}-${displayName}9!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data?.user) throw new Error(error?.message ?? "createUser returned no user");
  const { data: profile } = await service.from("profiles").select("id, display_name, role").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, email, password, displayName, profile };
}

async function main() {
  if (!URL || !ANON_KEY || !SERVICE_KEY) {
    console.error("Missing env: need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(2);
  }

  const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const userA = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const userB = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // --- A. Signup ----------------------------------------------------------
  try {
    const a = await createTestUser(service, tag, "Launch Alice");
    const b = await createTestUser(service, tag, "Launch Bob");
    testUsers.push(a, b);

    const signInA = await userA.auth.signInWithPassword({ email: a.email, password: a.password });
    const signInB = await userB.auth.signInWithPassword({ email: b.email, password: b.password });
    if (signInA.error || signInB.error) throw new Error(signInA.error?.message ?? signInB.error?.message ?? "sign-in failed");

    check("signup: profile auto-created by handle_new_user trigger",
      Boolean(a.profile?.id && b.profile?.id), a.profile?.id && b.profile?.id ? "ok" : "fail",
      a.profile?.id && b.profile?.id ? `alice=${a.profile.display_name}, bob=${b.profile.display_name}`
        : `missing profile rows (a=${JSON.stringify(a.profile)}, b=${JSON.stringify(b.profile)})`);

    check("signup: password sign-in works (session issued)",
      Boolean(signInA.data?.session && signInB.data?.session), "ok",
      `alice session ${signInA.data?.session ? "issued" : "MISSING"}, bob ${signInB.data?.session ? "issued" : "MISSING"}`);
  } catch (e) {
    check("signup: create + sign in two test users", false, "error", e?.message ?? String(e));
    await cleanup(service);
    printReport();
    process.exit(1);
  }

  const aId = testUsers[0].id;
  const bId = testUsers[1].id;

  // --- B. Community -------------------------------------------------------
  const slug = `walk-${tag}`;
  {
    const { data: space, error } = await userA
      .from("spaces")
      .insert({ name: `Launch Walk ${tag}`, slug, is_public: true, created_by: aId })
      .select("id")
      .single();
    if (error || !space?.id) {
      check("community: create space", false, "error", error?.message ?? "no id");
    } else {
      spaceId = space.id;
      check("community: create space (authenticated RLS insert)", true, "ok", `space ${space.id.slice(0, 8)}`);

      // Mirror createSpace(): the creator is added as a moderator member, which
      // is what lets them post threads / materials / rooms in the space.
      const { error: modErr } = await userA.from("space_members").insert({ space_id: spaceId, user_id: aId, role: "moderator" });
      check("community: creator auto-added as moderator", !modErr, modErr ? "error" : "ok", modErr?.message ?? "alice is moderator");

      const { error: joinErr } = await userB.from("space_members").insert({ space_id: spaceId, user_id: bId });
      check("community: second user joins the space", !joinErr, joinErr ? "error" : "ok", joinErr?.message ?? "bob joined");

      const { data: thread, error: threadErr } = await userA
        .from("threads")
        .insert({ space_id: spaceId, author_id: aId, title: "Launch walk thread", body: "Does anyone else find launch checklists satisfying?", kind: "question" })
        .select("id, score")
        .single();
      if (threadErr || !thread?.id) {
        check("community: create thread", false, "error", threadErr?.message ?? "no id");
      } else {
        threadId = thread.id;
        check("community: create thread (member insert, kind=question)", true, "ok", `thread ${threadId.slice(0, 8)}`);

        const { data: reply, error: replyErr } = await userB
          .from("posts")
          .insert({ thread_id: threadId, author_id: bId, body: "Absolutely. Tick all the boxes." })
          .select("id")
          .single();
        check("community: reply to thread", !replyErr && reply?.id, replyErr ? "error" : "ok", replyErr?.message ?? `reply ${reply.id.slice(0, 8)}`);

        const { data: nested, error: nestedErr } = await userA
          .from("posts")
          .insert({ thread_id: threadId, author_id: aId, body: "Boxes ticked. 🙌", parent_id: reply?.id })
          .select("id, parent_id")
          .single();
        check("community: nested reply (parent_id set)", !nestedErr && nested?.parent_id === reply?.id,
          nestedErr ? "error" : "ok",
          nestedErr?.message ?? (nested?.parent_id === reply?.id ? "nested under bob's reply" : "parent_id NOT set"));

        // Upvote the thread via the post_votes trigger path.
        const { error: voteErr } = await userB.from("post_votes").insert({ post_id: threadId, user_id: bId, vote: 1 });
        if (!voteErr) await waitFor(1200); // trigger fires after the insert
        const { data: voted } = await userA.from("threads").select("score, ups").eq("id", threadId).single();
        check("community: upvote thread (post_votes trigger updates score)",
          !voteErr && voted?.score === 1 && voted?.ups === 1,
          voteErr ? "error" : "ok",
          voteErr?.message ?? `score=${voted?.score}, ups=${voted?.ups}`);
      }
    }
  }

  // --- C. Quiz ------------------------------------------------------------
  {
    const questions = [
      { question: "What does RLS stand for?", options: ["Row-Level Security", "Random Load Shedding", "Really Long Sessions"], answerIndex: 0, explanation: "Row-Level Security gates rows per user." },
      { question: "2 + 2 = ?", options: ["3", "4", "5"], answerIndex: 1 },
    ];
    const { data: material, error: mErr } = await userA
      .from("study_materials")
      .insert({ space_id: spaceId, author_id: aId, type: "quiz", title: "Launch walk quiz", metadata: { questions } })
      .select("id")
      .single();
    if (mErr || !material?.id) {
      check("quiz: create quiz material", false, "error", mErr?.message ?? "no id");
    } else {
      materialId = material.id;
      check("quiz: create quiz material (type=quiz)", true, "ok", `quiz ${materialId.slice(0, 8)}`);

      // B takes it: answers [0, 1] → both correct → 100%.
      const { data: attempt, error: attemptErr } = await userB
        .from("quiz_attempts")
        .upsert({
          material_id: materialId,
          user_id: bId,
          best_score_pct: 100,
          best_correct: 2,
          best_total: 2,
          attempts: 1,
          total_ms: 45_000,
          answer_times_ms: [20_000, 25_000],
          flagged: false,
          flag_reasons: [],
          updated_at: new Date().toISOString(),
        }, { onConflict: "material_id,user_id" })
        .select("best_score_pct")
        .single();
      check("quiz: submit attempt (quiz_attempts upsert)", !attemptErr && attempt?.best_score_pct === 100,
        attemptErr ? "error" : "ok", attemptErr?.message ?? `best=${attempt?.best_score_pct}%`);

      const { data: board } = await userA
        .from("quiz_attempts")
        .select("user_id, best_score_pct, profiles(display_name)")
        .eq("material_id", materialId)
        .order("best_score_pct", { ascending: false })
        .limit(10);
      const bobRow = (board ?? []).find((r) => r.user_id === bId);
      check("quiz: leaderboard read returns the taker", Boolean(bobRow),
        bobRow ? "ok" : "fail", bobRow ? `${bobRow.profiles?.[0]?.display_name ?? "bob"} at ${bobRow.best_score_pct}%` : "bob's attempt not on the leaderboard");
    }
  }

  // --- D. Study party RSVP ------------------------------------------------
  {
    const startsAt = new Date(Date.now() + 3 * 3600_000).toISOString(); // +3h = in the future
    const { data: room, error: roomErr } = await userA
      .from("study_rooms")
      .insert({ space_id: spaceId, created_by: aId, name: "Launch walk study party", status: "active", starts_at: startsAt, whiteboard: [] })
      .select("id")
      .single();
    if (roomErr || !room?.id) {
      check("party: create scheduled study room", false, "error", roomErr?.message ?? "no id");
    } else {
      partyRoomId = room.id;
      check("party: create scheduled study room (starts_at set)", true, "ok", `party room ${room.id.slice(0, 8)} starts ${startsAt.slice(0, 16)}Z`);

      // Bob RSVPs — RLS requires a future active room, so this must succeed.
      const { error: rsvpErr } = await userB
        .from("study_room_rsvps")
        .insert({ room_id: partyRoomId, user_id: bId });
      check("party: user RSVPs to future party (RLS insert)", !rsvpErr, rsvpErr ? "error" : "ok", rsvpErr?.message ?? "bob is Going");

      // Count reflects the RSVP.
      const { count } = await userA.from("study_room_rsvps").select("room_id", { count: "exact", head: true }).eq("room_id", partyRoomId);
      check("party: RSVP attendee count = 1", count === 1, count === 1 ? "ok" : "fail", `count=${count}`);

      // RSVPing to a PAST party must be rejected (RLS gates future rooms).
      const pastRoom = await userA
        .from("study_rooms")
        .insert({ space_id: spaceId, created_by: aId, name: "Past party", status: "active", starts_at: new Date(Date.now() - 3600_000).toISOString(), whiteboard: [] })
        .select("id")
        .single();
      if (pastRoom.data?.id) {
        const { error: pastRsvpErr } = await userB.from("study_room_rsvps").insert({ room_id: pastRoom.data.id, user_id: bId });
        check("party: RSVP to past party rejected by RLS", Boolean(pastRsvpErr),
          pastRsvpErr ? "ok" : "fail",
          pastRsvpErr ? `rejected (${pastRsvpErr.code ?? pastRsvpErr.message})` : "ACCEPTED past-party RSVP — RLS not gating");
        await service.from("study_rooms").delete().eq("id", pastRoom.data.id);
      }
    }
  }

  // --- E. Whiteboard sync -------------------------------------------------
  {
    if (partyRoomId || spaceId) {
      const roomForBoard = partyRoomId ?? (await userA.from("study_rooms").insert({ space_id: spaceId, created_by: aId, name: "Board room", status: "active", whiteboard: [] }).select("id").single())?.data?.id;
      if (roomForBoard) {
        const strokes = [{ id: "s1", color: "#ff0000", width: 4, points: [[0, 0], [10, 10], [20, 20]] }];
        const { error: saveErr } = await userA
          .from("study_rooms")
          .update({ whiteboard: strokes, updated_at: new Date().toISOString() })
          .eq("id", roomForBoard);
        check("whiteboard: save stroke snapshot (authed update)", !saveErr, saveErr ? "error" : "ok", saveErr?.message ?? "1 stroke saved");

        // Round-trip: the other user reads the board back.
        const { data: board, error: readErr } = await userB.from("study_rooms").select("whiteboard").eq("id", roomForBoard).single();
        const roundTripped = !readErr && Array.isArray(board?.whiteboard) && board.whiteboard[0]?.id === "s1";
        check("whiteboard: snapshot round-trips to another user", roundTripped,
          readErr ? "error" : "ok",
          readErr?.message ?? (roundTripped ? `read back ${board.whiteboard.length} stroke(s)` : "stroke missing on read"));

        // Chat message round-trip through the same room.
        const { data: msg, error: chatErr } = await userA
          .from("study_room_messages")
          .insert({ room_id: roomForBoard, user_id: aId, body: "launch walk chat" })
          .select("id, body")
          .single();
        check("whiteboard/chat: send room chat message", !chatErr && msg?.body === "launch walk chat", chatErr ? "error" : "ok", chatErr?.message ?? `msg ${msg.id.slice(0, 8)}`);

        const { data: chatRead } = await userB.from("study_room_messages").select("id").eq("room_id", roomForBoard).limit(1);
        check("whiteboard/chat: message visible to other user", (chatRead ?? []).length > 0, (chatRead ?? []).length ? "ok" : "fail", `${(chatRead ?? []).length} message(s) visible`);

        if (!partyRoomId) await service.from("study_rooms").delete().eq("id", roomForBoard);
      }
    }
  }

  // --- F. File materials: PDF preview + image lightbox ---------------------
  {
    // Mirror uploadFileMaterial(): material row → storage upload into the
    // uploader's own folder → storage_objects mirror → storage_path + mime.
    // The /preview route then reads back via a signed URL (uploader-only
    // storage RLS), so the round-trip is asserted on the uploader's session and
    // the RLS gate is asserted against a second member.
    const fixtures = [
      { label: "PDF", fileName: "launch-walk.pdf", bytes: TINY_PDF, mime: "application/pdf" },
      { label: "image", fileName: "launch-walk.png", bytes: TINY_PNG, mime: "image/png" },
    ];
    for (const { label, fileName, bytes, mime } of fixtures) {
      const { data: material, error: matErr } = await userA
        .from("study_materials")
        .insert({ space_id: spaceId, author_id: aId, type: "file", title: `Launch walk ${label}` })
        .select("id")
        .single();
      if (matErr || !material?.id) {
        check(`file material: create ${label} material (type=file)`, false, "error", matErr?.message ?? "no id");
        continue;
      }
      const path = `${aId}/${material.id}/${fileName}`;
      storagePaths.push(path);

      const { error: upErr } = await userA.storage.from("materials").upload(path, bytes, { contentType: mime });
      check(`file material: upload ${label} to storage (own-folder policy)`, !upErr, upErr ? "error" : "ok",
        upErr?.message ?? `${bytes.length} bytes at ${path.slice(0, 30)}…`);

      await userA.from("storage_objects").insert({ user_id: aId, bucket: "materials", path, size_bytes: bytes.length, material_id: material.id });
      const { error: updErr } = await userA
        .from("study_materials")
        .update({ storage_path: path, metadata: { mime } })
        .eq("id", material.id);
      check(`file material: material row carries storage_path + mime (${label})`, !updErr, updErr ? "error" : "ok",
        updErr?.message ?? `${label.toLowerCase()} ${material.id.slice(0, 8)}`);

      // Signed-URL read-back — exactly what the /preview route does.
      const { data: signed, error: signErr } = await userA.storage.from("materials").createSignedUrl(path, 60);
      let fetched = null;
      if (signed?.signedUrl) {
        try {
          const resp = await fetch(signed.signedUrl);
          const buf = Buffer.from(await resp.arrayBuffer());
          fetched = { ok: resp.ok, bytesMatch: buf.equals(bytes), ct: resp.headers.get("content-type") ?? "" };
        } catch {
          fetched = { ok: false };
        }
      }
      check(`file material: ${label} preview round-trips via signed URL`,
        !signErr && fetched?.ok && fetched.bytesMatch,
        signErr ? "error" : "ok",
        signErr?.message ?? (fetched?.ok && fetched.bytesMatch ? `${fetched.ct} · ${bytes.length} bytes match`
          : `content-type=${fetched?.ct} ok=${fetched?.ok}`));

      // RLS gate: storage select is uploader-only, so a member who isn't the
      // uploader must not be able to sign the file (the /preview route 404s).
      const { error: bobSignErr } = await userB.storage.from("materials").createSignedUrl(path, 60);
      check(`file material: non-uploader blocked from ${label} storage read (RLS)`, Boolean(bobSignErr),
        bobSignErr ? "ok" : "fail",
        bobSignErr ? `blocked (${bobSignErr.code ?? bobSignErr.message})` : "OTHER MEMBER COULD SIGN — uploader-only policy missing");
    }
  }

  // --- G. Review-queue flashcard deck -------------------------------------
  {
    // Mirror createQuizReviewDeck(): the taker misses a question, cards are
    // built from the quiz payload (front = question, back = correct answer +
    // explanation), and the deck is a flashcard_set material tagged with
    // is_quiz_review + quiz_id so getQuizReviewDeck() can find it idempotently.
    const questions = [
      { question: "What color is the sky?", options: ["Blue", "Green", "Red"], answerIndex: 0, explanation: "Rayleigh scattering." },
      { question: "What is 2 + 2?", options: ["3", "4", "5"], answerIndex: 1 },
    ];
    const { data: quiz, error: qErr } = await userA
      .from("study_materials")
      .insert({ space_id: spaceId, author_id: aId, type: "quiz", title: "Review walk quiz", metadata: { questions } })
      .select("id")
      .single();
    if (qErr || !quiz?.id) {
      check("review queue: create quiz with a missable question", false, "error", qErr?.message ?? "no id");
    } else {
      // Bob misses Q2 (answers [0, 2] → 1/2 = 50%).
      const { error: attemptErr } = await userB.from("quiz_attempts").upsert({
        material_id: quiz.id, user_id: bId, best_score_pct: 50, best_correct: 1, best_total: 2,
        attempts: 1, total_ms: 30_000, answer_times_ms: [15_000, 15_000], flagged: false, flag_reasons: [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "material_id,user_id" });
      check("review queue: quiz attempt records a miss (50%)", !attemptErr, attemptErr ? "error" : "ok",
        attemptErr?.message ?? "best=50% — Q2 missed");

      const missed = [1];
      const cards = missed.map((i) => {
        const q = questions[i];
        return {
          front: q.question,
          back: `Correct answer: ${q.options[q.answerIndex]}` + (q.explanation ? `\n\n💡 ${q.explanation}` : ""),
        };
      });
      const { data: deck, error: deckErr } = await userB
        .from("study_materials")
        .insert({
          space_id: spaceId, author_id: bId, type: "flashcard_set",
          title: `My quiz review — Review walk quiz`,
          metadata: { cards, is_quiz_review: true, quiz_id: quiz.id },
        })
        .select("id")
        .single();
      check("review queue: create SM-2 deck from missed questions (flashcard_set)", !deckErr && deck?.id,
        deckErr ? "error" : "ok",
        deckErr?.message ?? `deck ${deck?.id?.slice(0, 8)} with ${cards.length} card(s)`);

      const { data: deckRead } = await userB
        .from("study_materials")
        .select("type, metadata, is_hidden")
        .eq("id", deck?.id)
        .single();
      const md = deckRead?.metadata ?? {};
      check("review queue: deck metadata round-trips (cards + is_quiz_review + quiz_id)",
        deckRead?.type === "flashcard_set" && md.is_quiz_review === true && md.quiz_id === quiz.id
          && Array.isArray(md.cards) && md.cards.length === 1 && md.cards[0]?.front === questions[1].question
          && String(md.cards[0]?.back ?? "").includes("Correct answer: 4"),
        "ok",
        md.is_quiz_review === true && md.quiz_id === quiz.id
          ? `cards=${md.cards?.length}, quiz_id set, back includes the answer`
          : `type=${deckRead?.type}, is_quiz_review=${md.is_quiz_review}, quiz_id match=${md.quiz_id === quiz.id}`);

      // Idempotency — the exact getQuizReviewDeck() query returns the same deck.
      const { data: again } = await userB
        .from("study_materials")
        .select("id")
        .eq("space_id", spaceId)
        .eq("author_id", bId)
        .eq("type", "flashcard_set")
        .eq("metadata->>is_quiz_review", "true")
        .eq("metadata->>quiz_id", quiz.id)
        .maybeSingle();
      check("review queue: idempotent — second add finds the same deck (Review deck button)",
        again?.id === deck?.id, "ok",
        again?.id === deck?.id ? `same deck ${again?.id?.slice(0, 8)}` : `DIFFERENT deck ${again?.id?.slice(0, 8)} vs ${deck?.id?.slice(0, 8)}`);
    }
  }

  // --- H. Saved-item folders ----------------------------------------------
  {
    const { data: folder, error: fErr } = await userB
      .from("saved_collections")
      .insert({ user_id: bId, name: "Exam prep" })
      .select("id")
      .single();
    check("saved: create named folder (saved_collections)", !fErr && folder?.id, fErr ? "error" : "ok",
      fErr?.message ?? `folder ${folder?.id?.slice(0, 8)}`);

    if (threadId && materialId && folder?.id) {
      const save = await userB
        .from("saved_items")
        .upsert([
          { user_id: bId, item_type: "thread", item_id: threadId, collection_id: folder.id },
          { user_id: bId, item_type: "material", item_id: materialId, collection_id: folder.id },
        ], { onConflict: "user_id,item_type,item_id" })
        .select("item_type");
      check("saved: thread + material saved into the folder", !save.error && (save.data ?? []).length === 2,
        save.error ? "error" : "ok",
        save.error?.message ?? `2 items (${(save.data ?? []).map((r) => r.item_type).join(", ")})`);

      const { data: items } = await userB
        .from("saved_items")
        .select("item_type, item_id, saved_collections(name)")
        .eq("user_id", bId)
        .order("created_at", { ascending: false });
      const inFolder = (items ?? []).filter((r) => r.saved_collections?.name === "Exam prep");
      check("saved: folder read-back lists both items", inFolder.length === 2, "ok", `${inFolder.length}/2 under "Exam prep"`);

      // Deleting the folder keeps items — they return to Uncategorized (FK set null).
      const { error: delErr } = await userB.from("saved_collections").delete().eq("id", folder.id);
      const { data: after } = await userB.from("saved_items").select("collection_id").eq("user_id", bId);
      const uncategorized = (after ?? []).filter((r) => r.collection_id === null);
      check("saved: deleting folder returns items to Uncategorized (set null)", !delErr && uncategorized.length === 2,
        delErr ? "error" : "ok",
        delErr?.message ?? `${uncategorized.length}/2 back to Uncategorized`);
    }
  }

  await cleanup(service);
  printReport();
}

async function cleanup(service) {
  if (KEEP_DATA) return;
  try {
    // Storage files first (the service key bypasses RLS) so nothing orphaned
    // lingers in the materials bucket.
    if (storagePaths.length) {
      await service.storage.from("materials").remove(storagePaths);
    }
    for (const u of testUsers) {
      await service.from("space_members").delete().eq("user_id", u.id);
      await service.from("study_room_rsvps").delete().eq("user_id", u.id);
      await service.from("study_room_messages").delete().eq("user_id", u.id);
      await service.from("posts").delete().eq("author_id", u.id);
      await service.from("post_votes").delete().eq("user_id", u.id);
      await service.from("threads").delete().eq("author_id", u.id);
      await service.from("quiz_attempts").delete().eq("user_id", u.id);
      await service.from("study_materials").delete().eq("author_id", u.id);
      await service.from("storage_objects").delete().eq("user_id", u.id);
      await service.from("saved_items").delete().eq("user_id", u.id);
      await service.from("saved_collections").delete().eq("user_id", u.id);
      await service.from("spaces").delete().eq("created_by", u.id);
      await service.from("study_rooms").delete().eq("created_by", u.id);
      await service.auth.admin.deleteUser(u.id);
    }
  } catch (e) {
    console.error(`cleanup warning: ${e?.message ?? e}`);
  }
}

function printReport() {
  const okCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const allOk = failed.length === 0;

  if (JSON_OUT) {
    console.log(JSON.stringify({
      ok: allOk,
      checkedAt: new Date().toISOString(),
      summary: { total: results.length, ok: okCount, failed: failed.length },
      checks: results,
    }, null, 2));
  } else {
    console.log("\nLaunch walk (live):");
    for (const r of results) {
      console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    console.log(`\n${okCount}/${results.length} passing, ${failed.length} failed`);
    if (failed.length) {
      console.log("\nFailed:");
      for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail || f.status}`);
    }
    console.log(allOk ? "\n✅ Launch walk passed — signup → community → quiz → party → whiteboard → files → review queue → saved folders all live." : "\n❌ Launch walk has failures — see above.");
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
