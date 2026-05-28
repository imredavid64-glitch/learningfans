export const USER_STORAGE_QUOTA_BYTES = 25 * 1024 * 1024; // 25 MB per user
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_NOTE_SIZE_BYTES = 50 * 1024; // 50 KB
export const MAX_FLASHCARDS_PER_SET = 100;

export const ALLOWED_FILE_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
] as const;

export const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
} as const;

export type ProfileRole = "student" | "moderator" | "admin";
export type SpaceMemberRole = "member" | "moderator";
export type MaterialType = "file" | "link" | "note" | "flashcard_set";
export type MaterialPriority = "urgent" | "high" | "normal" | "low";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type SanctionType = "warn" | "mute" | "suspend";
export type EventVisibility = "private" | "space";
export type AttendeeStatus = "going" | "maybe";
