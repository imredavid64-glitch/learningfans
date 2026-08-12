// Shared types + limits for the community (rules/announcements) feature.
// Client-safe: imported by both server actions and client components.

export const MAX_RULES = 20;
export const MAX_RULE_TITLE = 140;
export const MAX_RULE_BODY = 500;
export const MAX_ANNOUNCEMENTS = 20;
export const MAX_ANNOUNCEMENT_TITLE = 140;
export const MAX_ANNOUNCEMENT_BODY = 2000;

export interface CommunityRule {
  id: string;
  title: string;
  body?: string;
}

export interface CommunityAnnouncement {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

// --- Post flairs -------------------------------------------------------------

export const MAX_FLAIRS = 15;
export const MAX_FLAIR_LABEL = 40;

/** Fixed color palette — keys map to Tailwind classes below (static, safe). */
export const FLAIR_COLORS = [
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "orange", label: "Orange" },
  { id: "red", label: "Red" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
  { id: "teal", label: "Teal" },
  { id: "amber", label: "Amber" },
] as const;

export type FlairColorId = (typeof FLAIR_COLORS)[number]["id"];

/** Badge classes for a rendered flair chip. */
export const FLAIR_COLOR_CLASSES: Record<FlairColorId, string> = {
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  pink: "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  teal: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

/** Solid swatch color for pickers. */
export const FLAIR_SWATCH_CLASSES: Record<FlairColorId, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
};

export interface CommunityFlair {
  id: string;
  label: string;
  color: string;
}

export type FlairValidation =
  | { ok: true; flairs: CommunityFlair[] }
  | { ok: false; error: string };

/** Validate + normalize a raw flair list (shared by the save action). */
export function validateFlairs(raw: unknown): FlairValidation {
  if (!Array.isArray(raw)) return { ok: false, error: "Flairs must be a list." };
  if (raw.length > MAX_FLAIRS) {
    return { ok: false, error: `Communities can have up to ${MAX_FLAIRS} flairs.` };
  }

  const flairs: CommunityFlair[] = [];
  const seen = new Set<string>();
  for (const f of raw) {
    if (!f || typeof f !== "object") return { ok: false, error: "Invalid flair." };
    const rec = f as Record<string, unknown>;
    const label = String(rec.label ?? "").trim();
    if (!label) return { ok: false, error: "Every flair needs a label." };
    if (label.length > MAX_FLAIR_LABEL) {
      return { ok: false, error: `Flair labels are limited to ${MAX_FLAIR_LABEL} characters.` };
    }
    const color = String(rec.color ?? "");
    if (!(color in FLAIR_COLOR_CLASSES)) {
      return { ok: false, error: "Invalid flair color." };
    }
    const id = typeof rec.id === "string" && rec.id ? rec.id : crypto.randomUUID();
    if (seen.has(id)) return { ok: false, error: "Duplicate flair ids." };
    seen.add(id);
    flairs.push({ id, label, color });
  }

  return { ok: true, flairs };
}
