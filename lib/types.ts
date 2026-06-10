// Thinkr — shared TypeScript types (mirror of supabase/schema.sql)

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  // Onboarding answers used for Thought Twin matching.
  fingerprint: Fingerprint;
  created_at: string;
  // Captured by the onboarding survey (used to gate matches before the algorithm).
  age?: number | null;
  gender?: string | null;
  state?: string | null;
  region?: string | null;
  thinking_type?: string | null;
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
  created_at: string;
};

// Thought joined with author + the viewer's private resonance flag.
export type ThoughtWithMeta = Thought & {
  author: Pick<Profile, "id" | "username" | "display_name">;
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
