export const USER_STORAGE_QUOTA_BYTES = 25 * 1024 * 1024; // 25 MB per user
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB per file
export const MAX_NOTE_SIZE_BYTES = 50 * 1024; // 50 KB
export const MAX_FLASHCARDS_PER_SET = 100;
// Spaced-repetition decks live in study_materials.metadata (jsonb). Caps keep a
// single deck well under the row limit and the DB lean.
export const MAX_CARD_TEXT_LENGTH = 1000; // chars per card side
export const MAX_DECK_METADATA_BYTES = 150 * 1024; // ~150 KB per deck (incl. JSON overhead)

export const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
} as const;

export type ProfileRole = "student" | "moderator" | "admin";
export type SpaceMemberRole = "member" | "moderator";
export type MaterialType = "file" | "link" | "note" | "flashcard_set" | "quiz";
export type MaterialPriority = "urgent" | "high" | "normal" | "low";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type SanctionType = "warn" | "mute" | "suspend";
export type EventVisibility = "private" | "space";
export type AttendeeStatus = "going" | "maybe";
