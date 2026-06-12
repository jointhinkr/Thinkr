// Thinkr — shared TypeScript types (mirror of supabase/schema.sql)

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url?: string | null;
  // Onboarding answers used for Thought Twin matching.
  fingerprint: Fingerprint;
  created_at: string;
  // Captured by the onboarding survey (used to gate matches before the algorithm).
  age?: number | null;
  gender?: string | null;
  state?: string | null;
  region?: string | null;
  thinking_type?: string | null;
  // Authorized Beta Tester Exception (approved under-18 testers). See /terms.
  beta_tester?: boolean | null;
  // Privacy: when false, others cannot send this user connection requests.
  allow_connection_requests?: boolean | null;
  // Moderation: set by AI report assessment / manual review.
  suspended?: boolean | null;
  // When true (default), this user's resonated posts are hidden from others.
  resonances_private?: boolean | null;
  // Set when a livestream of theirs is reported; blocks going live again.
  livestream_revoked?: boolean | null;
  // Daily Spark streak.
  spark_streak?: number | null;
  spark_last_answered?: string | null;
  // Role / entitlements (Session 1+). admin inherits premium.
  role?: "user" | "premium" | "admin" | null;
};

// One-directional follow. muser follows muse.
export type Muse = {
  muser_id: string;
  muse_id: string;
  created_at: string;
};

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  thought_id: string | null;
  reason: string;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
  ai_severity: "none" | "low" | "medium" | "high" | "severe" | null;
  ai_action: "none" | "flag" | "suspend" | null;
  ai_rationale: string | null;
  created_at: string;
};

// Private matching preferences (own-row RLS — never shown publicly).
export type MatchPrefs = {
  user_id: string;
  match_genders: string[];
  match_age: string | null;
  local_twin: boolean | null;
  politics_include: boolean | null;
  political_lean: string | null;
};

// The "thinking fingerprint" captured during onboarding.
// Each axis is a normalized 0..1 score; extend freely.
export type Fingerprint = {
  // examples — tune to your onboarding questionnaire
  abstract_vs_concrete?: number;
  optimist_vs_skeptic?: number;
  builder_vs_critic?: number;
  solo_vs_social?: number;
  novelty_vs_depth?: number;
  [axis: string]: number | undefined;
};

export type Circle = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creator_id: string;
  created_at: string;
};

export type CircleMember = {
  circle_id: string;
  user_id: string;
  role: "member" | "organizer";
  joined_at: string;
};

export type Thought = {
  id: string;
  author_id: string;
  body: string;
  parent_id: string | null; // idea inheritance / branches
  circle_id: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  created_at: string;
};

// Thought joined with author + the viewer's private resonance flag.
export type ThoughtWithMeta = Thought & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  resonated: boolean;
  branch_count: number;
};

export type Resonance = {
  user_id: string;
  thought_id: string;
  created_at: string;
};

export type Match = {
  id: string;
  user_a: string;
  user_b: string;
  score: number; // 0..1
  created_at: string;
};

export type SparkPrompt = {
  id: string;
  prompt: string;
  active_date: string; // YYYY-MM-DD
};

export type SparkResponse = {
  id: string;
  prompt_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
