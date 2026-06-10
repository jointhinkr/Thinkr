// Thinkr — Thought Twin matching
// MVP approach: cosine similarity over the onboarding "fingerprint".
// Good enough to ship; upgrade to pgvector + embeddings of users'
// actual thoughts once you have real content volume.

import type { Fingerprint, Profile } from "./types";

const AXES = [
  "abstract_vs_concrete",
  "optimist_vs_skeptic",
  "builder_vs_critic",
  "solo_vs_social",
  "novelty_vs_depth",
] as const;

function toVector(fp: Fingerprint): number[] {
  return AXES.map((a) => (typeof fp[a] === "number" ? (fp[a] as number) : 0.5));
}

export function similarity(a: Fingerprint, b: Fingerprint): number {
  const va = toVector(a);
  const vb = toVector(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    na += va[i] * va[i];
    nb += vb[i] * vb[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Rank everyone else by similarity to `me`, return the top match.
export function findThoughtTwin(
  me: Profile,
  candidates: Profile[]
): { profile: Profile; score: number } | null {
  let best: { profile: Profile; score: number } | null = null;
  for (const c of candidates) {
    if (c.id === me.id) continue;
    const score = similarity(me.fingerprint, c.fingerprint);
    if (!best || score > best.score) best = { profile: c, score };
  }
  return best;
}
