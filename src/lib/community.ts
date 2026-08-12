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
