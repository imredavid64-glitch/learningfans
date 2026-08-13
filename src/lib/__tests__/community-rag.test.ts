import { describe, it, expect } from "vitest";
import {
  buildCorpus,
  rankChunks,
  tokenize,
  buildTutorPrompt,
  parseTutorResponse,
  type RagChunk,
  type RagMaterialInput,
  type RagThreadInput,
  type RagPostInput,
} from "@/lib/community-rag";

function chunk(id: string, title: string, text: string, kind: RagChunk["kind"] = "note"): RagChunk {
  return { id, kind, title, text, href: `/x/${id}` };
}

describe("buildCorpus", () => {
  it("extracts text from notes, flashcards, and quizzes", () => {
    const materials: RagMaterialInput[] = [
      {
        id: "n1",
        type: "note",
        title: "Kinematics",
        metadata: { content: "Velocity is displacement over time." },
      },
      {
        id: "f1",
        type: "flashcard_set",
        title: "Physics terms",
        metadata: { cards: [{ front: "v = ?", back: "d/t" }] },
      },
      {
        id: "q1",
        type: "quiz",
        title: "Motion quiz",
        metadata: {
          questions: [
            {
              question: "What is velocity?",
              options: ["Speed", "Displacement/time", "Mass"],
              answerIndex: 1,
              explanation: "Velocity is a vector.",
            },
          ],
        },
      },
    ];
    const corpus = buildCorpus(materials, [], [], "physics");
    expect(corpus).toHaveLength(3);
    expect(corpus[0]).toMatchObject({ kind: "note", href: "/app/spaces/physics/materials/n1" });
    expect(corpus[0].text).toContain("Velocity");
    expect(corpus[1].text).toContain("Q: v = ?");
    expect(corpus[2].text).toContain("Answer: Displacement/time");
  });

  it("falls back to title/description for links and files", () => {
    const materials: RagMaterialInput[] = [
      { id: "l1", type: "link", title: "Khan Academy", url: "https://x", description: "Videos" },
      { id: "p1", type: "file", title: "Lecture.pdf", description: "Chapter 2 slides" },
    ];
    const corpus = buildCorpus(materials, [], [], "physics");
    expect(corpus).toHaveLength(2);
    expect(corpus.find((c) => c.id === "material:l1")?.text).toContain("Videos");
    expect(corpus.find((c) => c.id === "material:p1")?.kind).toBe("file");
  });

  it("skips materials with no indexable text", () => {
    const materials: RagMaterialInput[] = [
      { id: "e1", type: "note", title: "Empty note", metadata: { content: "" } },
      { id: "n2", type: "note", title: "Good note", metadata: { content: "Real content" } },
    ];
    expect(buildCorpus(materials, [], [], "physics").map((c) => c.id)).toEqual(["material:n2"]);
  });

  it("indexes threads with their body + what-tried and posts", () => {
    const threads: RagThreadInput[] = [
      { id: "t1", title: "Derivative help", body: "How do I differentiate?", what_tried: "Power rule" },
    ];
    const posts: RagPostInput[] = [
      { id: "p1", thread_id: "t1", body: "Use the chain rule." },
    ];
    const corpus = buildCorpus([], threads, posts, "calc");
    const thread = corpus.find((c) => c.id === "thread:t1");
    expect(thread?.text).toContain("Power rule");
    expect(thread?.href).toBe("/app/spaces/calc/threads/t1");
    const post = corpus.find((c) => c.id === "post:p1");
    expect(post?.text).toBe("Use the chain rule.");
    expect(post?.href).toBe("/app/spaces/calc/threads/t1");
  });
});

describe("rankChunks", () => {
  const chunks = [
    chunk("a", "Mitochondria", "The mitochondria is the powerhouse of the cell."),
    chunk("b", "Newton's laws", "An object in motion stays in motion unless acted on by a force."),
    chunk("c", "Cell theory", "All living things are made of cells."),
  ];

  it("ranks by term overlap with a title boost", () => {
    const ranked = rankChunks("mitochondria", chunks, 3);
    expect(ranked[0].id).toBe("a");
  });

  it("drops chunks with no overlap and respects the limit", () => {
    expect(rankChunks("photosynthesis", chunks, 3)).toEqual([]);
    expect(rankChunks("cell", chunks, 1)).toHaveLength(1);
  });

  it("returns a capped slice for an empty query", () => {
    expect(rankChunks("", chunks, 2)).toHaveLength(2);
  });
});

describe("tokenize", () => {
  it("normalizes, dedupes, and drops short tokens", () => {
    expect(tokenize("The MITOCHONDRIA is, the mitochondria!! a")).toEqual(["the", "mitochondria", "is"]);
  });
});

describe("buildTutorPrompt + parseTutorResponse", () => {
  const chunks = [
    chunk("a", "Kinematics", "Velocity = displacement / time."),
    chunk("b", "Newton 2", "F = ma."),
  ];

  it("embeds numbered context and asks for JSON citations", () => {
    const { system, user } = buildTutorPrompt("what is velocity?", chunks);
    expect(system).toContain("librarian");
    expect(user).toContain("[1] Kinematics");
    expect(user).toContain("[2] Newton 2");
    expect(user).toContain("citations");
  });

  it("parses a clean JSON response into answer + cited chunks", () => {
    const raw = JSON.stringify({ answer: "Velocity is displacement/time.", citations: [1] });
    const result = parseTutorResponse(raw, chunks);
    expect(result?.answer).toBe("Velocity is displacement/time.");
    expect(result?.citations.map((c) => c.id)).toEqual(["a"]);
  });

  it("tolerates a prose wrapper and ignores out-of-range citations", () => {
    const raw = 'Sure! {"answer": "F = ma", "citations": [2, 9]}';
    const result = parseTutorResponse(raw, chunks);
    expect(result?.answer).toBe("F = ma");
    expect(result?.citations.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns null for unusable responses", () => {
    expect(parseTutorResponse("not json", chunks)).toBeNull();
    expect(parseTutorResponse(JSON.stringify({ answer: "" }), chunks)).toBeNull();
  });
});
