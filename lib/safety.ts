// Client-side guard against sharing real-world contact info in chats.
// Thinkr keeps communication in-app; people meet only at moderated Gatherings.
// This is a first-line filter (regex). It catches the common cases; a determined
// user can still evade it, so it is backed by reporting + AI moderation.

export type ContactKind = "phone" | "email" | "address" | null;

const EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

// Street address: a number followed (within a few words) by a street-type word.
const ADDRESS =
  /\b\d{1,6}\s+(?:[A-Za-z0-9.'\-]+\s+){0,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|ter|circle|cir|highway|hwy|suite|ste|apt|apartment|unit)\b/i;

// A run of 7+ digits separated only by spaces, dots, dashes or parens → phone-like.
const PHONE = /(?:\+?\d[\s.\-()]*){7,}/;

export function detectContactInfo(text: string): { blocked: boolean; kind: ContactKind } {
  if (!text) return { blocked: false, kind: null };
  if (EMAIL.test(text)) return { blocked: true, kind: "email" };
  if (ADDRESS.test(text)) return { blocked: true, kind: "address" };
  const digitCount = (text.match(/\d/g) || []).length;
  if (digitCount >= 7 && PHONE.test(text)) return { blocked: true, kind: "phone" };
  return { blocked: false, kind: null };
}

export function contactWarning(kind: ContactKind): string {
  const what = kind === "phone" ? "a phone number" : kind === "email" ? "an email address" : kind === "address" ? "a street address" : "contact info";
  return `Looks like ${what}. To keep everyone safe, Thinkr keeps conversations in-app — sharing phone numbers, emails, or addresses isn't allowed. Meet only at a moderated Gathering.`;
}

export const SAFETY_RULE = "Keep it in Thinkr — don't share phone numbers, emails, or addresses. Meet only at moderated Gatherings.";
