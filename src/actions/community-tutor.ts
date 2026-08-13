"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSpaceMembership } from "@/lib/auth";
import { containsProfanity } from "@/lib/profanity";
import {
  buildCorpus,
  buildTutorPrompt,
  parseTutorResponse,
  rankChunks,
  type RagMaterialInput,
  type RagPostInput,
  type RagThreadInput,
} from "@/lib/community-rag";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MAX_QUESTION_LENGTH = 500;
const MAX_CONTEXT_CHUNKS = 6;
const CORPUS_LIMITS = { materials: 200, threads: 100, posts: 200 };

export interface TutorCitation {
  title: string;
  href: string;
  kind: string;
}

export interface TutorResponse {
  ok: boolean;
  answer?: string;
  citations?: TutorCitation[];
  error?: string;
}

/**
 * Ask the community librarian: retrieve the community's own notes, flashcards,
 * quizzes, threads, and posts, rank them against the question, and answer
 * grounded in the top chunks with citations back to each source.
 */
export async function askCommunityTutor(
  spaceSlug: string,
  question: string,
): Promise<TutorResponse> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const q = String(question ?? "").trim();
  if (!q) return { ok: false, error: "Ask a question first." };
  if (q.length > MAX_QUESTION_LENGTH) {
    return { ok: false, error: `Keep questions under ${MAX_QUESTION_LENGTH} characters.` };
  }
  if (!containsProfanity(q).clean) {
    return { ok: false, error: "Keep questions educational — that one was flagged." };
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("id, is_public")
    .eq("slug", String(spaceSlug).trim())
    .single();
  if (!space) return { ok: false, error: "Community not found." };

  const membership = await getSpaceMembership(space.id, profile.id);
  if (!space.is_public && !membership) {
    return { ok: false, error: "Join this community to ask its librarian." };
  }

  // Gather the community's text-native corpus (notes, flashcards, quizzes,
  // links, files-by-metadata, threads, and posts).
  const { data: materials } = await supabase
    .from("study_materials")
    .select("id, type, title, url, description, metadata")
    .eq("space_id", space.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(CORPUS_LIMITS.materials);

  const { data: threads } = await supabase
    .from("threads")
    .select("id, title, body, what_tried")
    .eq("space_id", space.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(CORPUS_LIMITS.threads);

  const threadIds = (threads ?? []).map((t) => t.id);
  const { data: posts } = threadIds.length
    ? await supabase
        .from("posts")
        .select("id, thread_id, body")
        .in("thread_id", threadIds)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(CORPUS_LIMITS.posts)
    : { data: null };

  const chunks = buildCorpus(
    (materials ?? []) as RagMaterialInput[],
    (threads ?? []) as RagThreadInput[],
    (posts ?? []) as RagPostInput[],
    String(spaceSlug).trim(),
  );
  const top = rankChunks(q, chunks, MAX_CONTEXT_CHUNKS);

  if (top.length === 0) {
    return {
      ok: true,
      answer:
        "This community doesn't have any notes, quizzes, flashcards, or discussions " +
        "for me to search yet. Ask again once members have shared some study materials.",
      citations: [],
    };
  }

  if (!GROQ_API_KEY) {
    return { ok: false, error: "The community librarian isn't configured yet (GROQ_API_KEY missing)." };
  }

  const { system, user } = buildTutorPrompt(q, top);

  let raw: string | null = null;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") raw = content;
  } catch (error) {
    console.error("Community tutor Groq error:", error);
    return { ok: false, error: "The librarian hit a snag — try again in a moment." };
  }

  const parsed = raw ? parseTutorResponse(raw, top) : null;
  if (!parsed) {
    // Model ignored the JSON contract — still return the raw text, uncited.
    return {
      ok: true,
      answer: raw ?? "No answer was generated. Try rephrasing the question.",
      citations: [],
    };
  }

  return {
    ok: true,
    answer: parsed.answer,
    citations: parsed.citations.map((c) => ({ title: c.title, href: c.href, kind: c.kind })),
  };
}
