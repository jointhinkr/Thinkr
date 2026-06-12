// Thinkr — Authorized Beta Tester program.
// One universal access code, handed out personally by Thinkr to trusted
// under-18 testers (friends & family). See the Authorized Beta Tester
// Exception in /terms. This is an MVP control, not hardened security — the
// code gates the UI and is recorded on the profile (beta_tester) for audit.

export const BETA_CODE = "BETA-TST-THKR-7Q4M2P";

// Case-insensitive, whitespace-tolerant compare so a pasted code still works.
export function isValidBetaCode(input: string | null | undefined): boolean {
  if (!input) return false;
  return input.trim().toUpperCase() === BETA_CODE;
}
