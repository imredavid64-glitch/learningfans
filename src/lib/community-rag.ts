// Community RAG tutor — retrieval + prompt building, framework-free so it can
// be unit tested and shared between the server action and any future index.
//
// This is a *lexical* retrieval layer (keyword overlap with a title boost), not
// a vector/embedding search: it grounds the LLM in the community's own notes,
// flashcards, quizzes, threads, and posts, ranked by relevance, with citations
// back to the source material. No vector DB or embeddings dependency required.

import type { QuizQuestion } from "@/lib/quizzes";

export type RagChunkKind =
  | "note"
  | "flashcard"
  | "quiz"
  | "link"
  | "file"
  | "thread"
  | "post";

export interface RagChunk {
  id: string;
  kind: RagChunkKind;
  title: string;
  text: string;
  href: string;
}

export interface RagMaterialInput {
  id: string;
  type: string;
  title: string;
  url?: string | null;
  description?: string | null;
  metadata?: unknown;
}

export interface RagThreadInput {
  id: string;
  title: string;
  body?: string | null;
  what_tried?: string | null;
}

export interface RagPostInput {
  id: string;
  thread_id: string;
  body: string;
}

/** Hard cap on a single chunk's text sent to the model (cost/safety). */
export const RAG_MAX_CHUNK_TEXT = 4000;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Text for a flashcard set: each card's front/back pair. */
function flashcardsText(metadata: Record<string, unknown>): string {
  const cards = Array.isArray(metadata.cards) ? metadata.cards : [];
  return cards
    .map((c) => {
      if (!c || typeof c !== "object") return "";
      const rec = c as Record<string, unknown>;
      const front = asString(rec.front);
      const back = asString(rec.back);
      return front && back ? `Q: ${front}\nA: ${back}` : front || back;
    })
    .filter(Boolean)
    .join("\n");
}

/** Text for a quiz: questions with their correct answer + explanation. */
function quizText(metadata: Record<string, unknown>): string {
  const questions = Array.isArray(metadata.questions) ? (metadata.questions as QuizQuestion[]) : [];
  return questions
    .map((q) => {
      if (!q || typeof q !== "object") return "";
      const options = Array.isArray(q.options) ? q.options : [];
      const correct = options[q.answerIndex] ?? "";
      const lines = [`Q: ${asString(q.question)}`];
      if (options.length) lines.push(`Options: ${options.map(asString).join(" | ")}`);
      if (correct) lines.push(`Answer: ${correct}`);
      if (asString(q.explanation)) lines.push(`Explanation: ${asString(q.explanation)}`);
      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n");
}

function materialChunk(m: RagMaterialInput, spaceSlug: string): RagChunk | null {
  const metadata = asMetadata(m.metadata);
  const base = {
    id: `material:${m.id}`,
    href: `/app/spaces/${spaceSlug}/materials/${m.id}`,
  };

  switch (m.type) {
    case "note": {
      const text = asString(metadata.content);
      if (!text) return null;
      return { ...base, kind: "note", title: m.title, text };
    }
    case "flashcard_set": {
      const text = flashcardsText(metadata);
      if (!text) return null;
      return { ...base, kind: "flashcard", title: m.title, text };
    }
    case "quiz": {
      const text = quizText(metadata);
      if (!text) return null;
      return { ...base, kind: "quiz", title: m.title, text };
    }
    case "link": {
      const text = [m.description ?? "", m.url ?? ""].filter(Boolean).join("\n");
      return { ...base, kind: "link", title: m.title, text: text || m.title };
    }
    case "file": {
      // PDFs are indexed by title/description until full-text extraction lands.
      const text = [m.description ?? ""].filter(Boolean).join("\n");
      return { ...base, kind: "file", title: m.title, text: text || m.title };
    }
    default: {
      const text = [m.description ?? ""].filter(Boolean).join("\n");
      if (!text) return null;
      return { ...base, kind: "file", title: m.title, text };
    }
  }
}

/**
 * Build the searchable corpus for a community from its materials, threads, and
 * posts. Returns the chunks in a stable order (materials, then threads, then
 * posts) with route hrefs back to each source.
 */
export function buildCorpus(
  materials: RagMaterialInput[],
  threads: RagThreadInput[],
  posts: RagPostInput[],
  spaceSlug: string,
): RagChunk[] {
  const chunks: RagChunk[] = [];

  for (const m of materials ?? []) {
    if (!m?.id || !m?.title) continue;
    const chunk = materialChunk(m, spaceSlug);
    if (chunk) chunks.push(chunk);
  }

  for (const t of threads ?? []) {
    if (!t?.id || !t?.title) continue;
    const text = [t.body ?? "", t.what_tried ?? ""].filter(Boolean).join("\n\n");
    chunks.push({
      id: `thread:${t.id}`,
      kind: "thread",
      title: t.title,
      text: text || t.title,
      href: `/app/spaces/${spaceSlug}/threads/${t.id}`,
    });
  }

  for (const p of posts ?? []) {
    if (!p?.id || !p?.thread_id) continue;
    const text = asString(p.body);
    if (!text) continue;
    chunks.push({
      id: `post:${p.id}`,
      kind: "post",
      title: "Discussion reply",
      text,
      href: `/app/spaces/${spaceSlug}/threads/${p.thread_id}`,
    });
  }

  return chunks;
}

/** Split text into normalized search terms (lowercase, ≥2 chars). */
export function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2),
    ),
  ];
}

/**
 * Lexical retrieval: score each chunk by how many query terms it contains
 * (title matches weigh more), keep the top `limit`. Chunks with zero overlap
 * are dropped; ties break toward shorter (more focused) text.
 */
export function rankChunks(query: string, chunks: RagChunk[], limit: number): RagChunk[] {
  const terms = tokenize(query);
  if (terms.length === 0) return chunks.slice(0, limit);

  return chunks
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      const title = chunk.title.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (text.includes(term)) score += 1;
        if (title.includes(term)) score += 3;
      }
      return { chunk, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.text.length - b.chunk.text.length)
    .slice(0, limit)
    .map((s) => s.chunk);
}

/** Build the system + user prompts that ground the answer in the chunks. */
export function buildTutorPrompt(
  question: string,
  chunks: RagChunk[],
): { system: string; user: string } {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title} (${c.kind})\n${c.text.slice(0, RAG_MAX_CHUNK_TEXT)}`,
    )
    .join("\n\n");

  const system =
    "You are the community librarian AI for a study community. Answer the student's " +
    "question using ONLY the provided content from this community's own materials, " +
    "notes, quizzes, flashcards, and discussions. Be accurate, educational, and concise. " +
    "Do not invent facts that are not in the context. If the context does not contain " +
    "the answer, say so clearly and suggest what the community is missing.";

  const user =
    `Question: ${question}\n\nCommunity content:\n${context}\n\n` +
    `Return JSON ONLY in this exact shape:\n{ "answer": string, "citations": number[] }\n` +
    `where "citations" lists the 1-based [index] numbers of the context entries you actually used.`;

  return { system, user };
}

export interface TutorAnswer {
  answer: string;
  citations: RagChunk[];
}

/**
 * Parse the model's JSON response into an answer + the cited chunks. Tolerant
 * of a leading/trailing prose wrapper; returns null only when no usable answer
 * was produced.
 */
export function parseTutorResponse(raw: string, chunks: RagChunk[]): TutorAnswer | null {
  let parsed: { answer?: unknown; citations?: unknown } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }
  if (!parsed || typeof parsed !== "object") return null;

  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) return null;

  const seen = new Set<number>();
  const citations: RagChunk[] = [];
  if (Array.isArray(parsed.citations)) {
    for (const rawIdx of parsed.citations) {
      const idx = Number(rawIdx);
      if (!Number.isInteger(idx) || idx < 1 || idx > chunks.length || seen.has(idx)) continue;
      seen.add(idx);
      citations.push(chunks[idx - 1]);
    }
  }

  return { answer, citations };
}
