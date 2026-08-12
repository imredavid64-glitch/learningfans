import type {
  AttendeeStatus,
  EventVisibility,
  MaterialPriority,
  MaterialType,
  ProfileRole,
  ReportStatus,
  SanctionType,
  SpaceMemberRole,
} from "@/lib/constants";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: ProfileRole;
  storage_used_bytes: number;
  created_at: string;
};

export type Space = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  /** Community rules/announcements/flairs live as jsonb (see migrations 0006/0009). */
  rules?: unknown;
  announcements?: unknown;
  flairs?: unknown;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: SpaceMemberRole;
  joined_at: string;
};

export type Thread = {
  id: string;
  space_id: string;
  author_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_hidden: boolean;
  score: number;
  ups: number;
  downs: number;
  /** References a flair id from the space's flairs jsonb list. */
  flair_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
};

export type StudyMaterial = {
  id: string;
  space_id: string;
  author_id: string;
  type: MaterialType;
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  community_score: number;
  is_hidden: boolean;
  created_at: string;
};

export type MaterialPriorityRow = {
  material_id: string;
  user_id: string;
  priority: MaterialPriority;
  due_at: string | null;
  notes: string | null;
  updated_at: string;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string;
  owner_id: string | null;
  space_id: string | null;
  visibility: EventVisibility;
  linked_material_id: string | null;
  reminder_minutes_before: number | null;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: "thread" | "post" | "material" | "profile";
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
};

export type UserMaterialRanking = {
  user_id: string;
  material_id: string;
  space_id: string;
  title: string;
  type: MaterialType;
  community_score: number;
  priority: MaterialPriority;
  due_at: string | null;
  notes: string | null;
  rank_score: number;
  created_at: string;
};

export type UserSanction = {
  id: string;
  user_id: string;
  type: SanctionType;
  expires_at: string | null;
  reason: string;
  created_by: string;
  created_at: string;
};

export type AttendeeStatusType = AttendeeStatus;

export type UserStats = {
  user_id: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  daily_checkin_date: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_xp: number;
  level: number;
  current_streak: number;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};
