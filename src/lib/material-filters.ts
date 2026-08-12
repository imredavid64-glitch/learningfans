import type { StudyMaterial } from "@/types/database";

export type MaterialFilter = "all" | "pdf" | "image" | "file" | "link" | "note" | "quiz";

export const MATERIAL_FILTERS: { id: MaterialFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "📄 PDFs" },
  { id: "image", label: "🖼️ Images" },
  { id: "file", label: "📁 Files" },
  { id: "link", label: "🔗 Links" },
  { id: "note", label: "📝 Notes" },
  { id: "quiz", label: "⚡ Quizzes" },
];

/** Reddit-style content filter for the community materials feed. */
export function matchesMaterialFilter(
  m: Pick<StudyMaterial, "type" | "metadata">,
  filter: MaterialFilter,
): boolean {
  const mime = (m.metadata?.mime as string | undefined) ?? "";
  switch (filter) {
    case "all":
      return true;
    case "pdf":
      return m.type === "file" && mime === "application/pdf";
    case "image":
      return m.type === "file" && mime.startsWith("image/");
    case "file":
      return m.type === "file" && mime !== "application/pdf" && !mime.startsWith("image/");
    case "link":
      return m.type === "link";
    case "note":
      return m.type === "note";
    case "quiz":
      return m.type === "quiz" || m.type === "flashcard_set";
  }
}
