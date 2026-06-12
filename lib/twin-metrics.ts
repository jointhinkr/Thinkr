// Hashtags + quiz answers feed the Thought Twin fingerprint.
// Recognized "axis" hashtags nudge a fingerprint dimension toward a target
// value; quiz answers write q:<key> dimensions directly (see lib/twin-quiz).

import type { Fingerprint } from "./types";

// tag -> [fingerprint key, target value 0..1]
export const HASHTAG_AXES: Record<string, [string, number]> = {
  abstract: ["abstract_vs_concrete", 1], concrete: ["abstract_vs_concrete", 0],
  optimist: ["optimist_vs_skeptic", 1], optimism: ["optimist_vs_skeptic", 1],
  skeptic: ["optimist_vs_skeptic", 0], skeptical: ["optimist_vs_skeptic", 0],
  builder: ["builder_vs_critic", 1], maker: ["builder_vs_critic", 1],
  critic: ["builder_vs_critic", 0], refiner: ["builder_vs_critic", 0],
  solo: ["solo_vs_social", 1], social: ["solo_vs_social", 0],
  explorer: ["novelty_vs_depth", 1], novelty: ["novelty_vs_depth", 1],
  depth: ["novelty_vs_depth", 0], deepdive: ["novelty_vs_depth", 0],
  stem: ["q:field", 1], science: ["q:field", 1], humanities: ["q:field", 0], arts: ["q:field", 0],
};

// Extract unique, lowercased hashtags (must start with a letter).
export function parseHashtags(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const re = /#([a-zA-Z][a-zA-Z0-9_]{0,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1].toLowerCase());
  return [...out];
}

// Nudge the fingerprint toward each recognized tag's axis target (light EMA so
// a single post never dominates). Returns the updated fingerprint, or null if
// no recognized tags changed anything.
export function applyHashtagMetrics(fingerprint: Fingerprint, tags: string[]): Fingerprint | null {
  let changed = false;
  const fp: Fingerprint = { ...fingerprint };
  for (const tag of tags) {
    const axis = HASHTAG_AXES[tag];
    if (!axis) continue;
    const [key, target] = axis;
    const cur = typeof fp[key] === "number" ? (fp[key] as number) : 0.5;
    fp[key] = Math.round((cur * 0.85 + target * 0.15) * 1000) / 1000;
    changed = true;
  }
  return changed ? fp : null;
}
