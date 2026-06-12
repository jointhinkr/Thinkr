// Thinkr — Thought Twin matching
// Cosine similarity over the onboarding "fingerprint" PLUS any extra
// dimensions the user has accrued (q:<key> from the endless Twin quiz,
// hashtag-nudged axes). The 5 core axes are always compared; extra
// dimensions either person has are included, defaulting the other to 0.5.

import type { Fingerprint, Profile } from "./types";

const CORE_AXES = [
  "abstract_vs_concrete",
  "optimist_vs_skeptic",
  "builder_vs_critic",
  "solo_vs_social",
  "novelty_vs_depth",
] as const;

function comparedKeys(a: Fingerprint, b: Fingerprint): string[] {
  const keys = new Set<string>(CORE_AXES);
  for (const k of Object.keys(a ?? {})) if (typeof a[k] === "number") keys.add(k);
  for (const k of Object.keys(b ?? {})) if (typeof b[k] === "number") keys.add(k);
  return [...keys];
}

function vectorFor(fp: Fingerprint, keys: string[]): number[] {
  return keys.map((k) => (typeof fp?.[k] === "number" ? (fp[k] as number) : 0.5));
}

export function similarity(a: Fingerprint, b: Fingerprint): number {
  const keys = comparedKeys(a ?? {}, b ?? {});
  const va = vectorFor(a ?? {}, keys);
  const vb = vectorFor(b ?? {}, keys);
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
