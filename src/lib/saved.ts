// Shared limits for the save / bookmark collections feature.
// Client-safe: imported by both server actions and client components.

export const MAX_COLLECTION_NAME = 60;

export type SavedItemType = "thread" | "material";
