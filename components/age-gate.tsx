"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidBetaCode } from "@/lib/beta";

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export default function AgeGate() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [needed, setNeeded] = useState(false);
  const [dob, setDob] = useState("");
  const [stage, setStage] = useState<"age" | "terms">("age");
  const [agree, setAgree] = useState(false);
  const [betaOpen, setBetaOpen] = useState(false);
  const [betaChecked, setBetaChecked] = useState(false);
  const [betaCode, setBetaCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setChecked(true); return; }
      const { data } = await supabase.from("profiles").select("age_verified").eq("id", user.id).single();
      setNeeded(!data?.age_verified);
      setChecked(true);
    });
  }, []);

  if (!checked || !needed) return null;

  const age = dob ? ageFromDob(dob) : null;
  const isAdult = age != null && age >= 18;
  const isMinor = age != null && age < 18;
  const codeValid = isValidBetaCode(betaCode);
  const betaReady = isMinor && betaChecked && codeValid;
  const canAccept = (isAdult && agree) || betaReady;

  function continueFromAge() {
    if (age == null) return;
    setStage("terms");
  }

  async function accept() {
    if (!canAccept || age == null) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const now = new Date().toISOString();
    await supabase.from("profiles").update({
      age_verified: true,
      terms_accepted_at: now,
      age,
      beta_tester: betaReady,
      ...(betaReady ? { beta_code_redeemed_at: now } : {}),
    }).eq("id", user.id);
    setNeeded(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(28,20,11,0.5)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-[440px] rounded-[24px] p-6 animate-rise max-h-[92dvh] overflow-y-auto"
        style={{ background: "var(--paper)", boxShadow: "var(--shadow-lg)" }}>

        {stage === "age" && (
          <>
            <div className="font-label" style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--flame)", marginBottom: 12 }}>
              One quick check
            </div>
            <h2 className="font-display text-[26px] leading-tight" style={{ fontWeight: 600, color: "var(--ink-1)" }}>
              How old are you?
            </h2>
            <p className="mt-2 text-[15px]" style={{ color: "var(--ink-60)" }}>
              Thinkr verifies age to keep the community safe. We store only your age and whether you&apos;re 18+, never your date of birth.
            </p>
            <label className="block font-semibold text-[14px] mt-5 mb-1.5">Date of birth</label>
            <input type="date" value={dob} max={new Date().toISOString().split("T")[0]} onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-[16px]" style={{ background: "#fff", border: "1.5px solid var(--line)", color: "var(--ink-1)" }} />
            <button onClick={continueFromAge} disabled={!dob}
              className="mt-6 w-full px-6 py-3.5 rounded-full text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
              Continue
            </button>
          </>
        )}

        {stage === "terms" && (
          <>
            <div className="font-label" style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--flame)", marginBottom: 12 }}>
              Almost in
            </div>
            <h2 className="font-display text-[26px] leading-tight" style={{ fontWeight: 600, color: "var(--ink-1)" }}>
              Terms &amp; Conditions
            </h2>
            <div className="mt-4 rounded-xl p-4 text-[13px] max-h-36 overflow-y-auto"
              style={{ background: "var(--cream)", border: "1px solid var(--line)", color: "var(--ink-60)", lineHeight: 1.55 }}>
              <p>
                Thinkr is an 18+ community for genuine connection — not a dating app. Be kind: no explicit, harmful, or
                threatening content anywhere on Thinkr. You attend any gathering at your own risk. Thought Twin matching is
                always optional — you can switch, block, or stop anytime. Your private data is encrypted and never sold.
              </p>
              <p className="mt-2">
                <Link href="/terms" target="_blank" style={{ color: "var(--flame)", fontWeight: 600 }}>
                  Read the full Terms, Privacy &amp; Cookie policies →
                </Link>
              </p>
            </div>

            {/* Adult 18+ acceptance */}
            <label className={`flex items-start gap-2.5 mt-4 ${isMinor ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input type="checkbox" checked={agree && !isMinor} disabled={isMinor}
                onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-orange-600 w-4 h-4" />
              <span className="text-[14px]" style={{ color: "var(--ink-1)" }}>I&apos;m 18 or older and I agree to the Terms &amp; Privacy Policy.</span>
            </label>
            {isMinor && (
              <p className="text-[12px] mt-1.5 ml-7" style={{ color: "var(--ink-40)" }}>
                Your date of birth indicates you&apos;re under 18.
              </p>
            )}

            {/* Beta tester check-in link */}
            {!betaOpen && (
              <button onClick={() => setBetaOpen(true)} className="mt-3 text-[13px] underline" style={{ color: "var(--flame)" }}>
                or check-in as an authorized beta tester
              </button>
            )}

            {/* Beta tester section */}
            {betaOpen && (
              <div className="mt-4 rounded-xl p-4" style={{ background: "#FFF6EC", border: "1px solid var(--amber)" }}>
                <label className={`flex items-start gap-2.5 ${isAdult ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={betaChecked && !isAdult} disabled={isAdult}
                    onChange={(e) => setBetaChecked(e.target.checked)} className="mt-0.5 accent-orange-600 w-4 h-4" />
                  <span className="text-[13px]" style={{ color: "var(--ink-1)", lineHeight: 1.5 }}>
                    I am an authorized Thinkr Beta Tester under the age of 18 and have received an official beta access code
                    from Thinkr. I understand that this exception applies only to approved testing accounts and may be revoked
                    at any time.
                  </span>
                </label>

                {isAdult ? (
                  <p className="text-[12px] mt-2.5" style={{ color: "var(--ink-60)" }}>
                    This exception is for testers under 18. You&apos;re 18+, so just agree above to enter Thinkr.
                  </p>
                ) : (
                  <>
                    <label className="block font-semibold text-[13px] mt-3 mb-1.5" style={{ color: "var(--ink-1)" }}>Beta access code</label>
                    <input
                      type="text" value={betaCode} onChange={(e) => setBetaCode(e.target.value)} autoComplete="off"
                      placeholder="BETA-XXX-XXXX-XXXXXX" disabled={!betaChecked}
                      className="w-full rounded-xl px-4 py-2.5 text-[15px] tracking-wider disabled:opacity-50"
                      style={{ background: "#fff", border: `1.5px solid ${betaCode && !codeValid ? "#dc2626" : "var(--line)"}`, color: "var(--ink-1)" }} />
                    {betaCode.length > 0 && !codeValid && (
                      <p className="text-[12px] mt-1.5" style={{ color: "#dc2626" }}>That code isn&apos;t valid. Check with Thinkr.</p>
                    )}
                    {betaReady && (
                      <p className="text-[12px] mt-1.5" style={{ color: "var(--flame)", fontWeight: 600 }}>✓ Code verified.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <button onClick={accept} disabled={!canAccept || saving}
              className="mt-5 w-full px-6 py-3.5 rounded-full text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
              {saving ? "Entering…" : "Agree & enter Thinkr"}
            </button>

            {isMinor && !betaReady && (
              <p className="text-[12.5px] mt-3 text-center" style={{ color: "var(--ink-60)", lineHeight: 1.5 }}>
                🌱 Thinkr is 18+ for now. Under-18s can only enter as an authorized beta tester with an official code — and
                are only ever matched with other under-18s.
              </p>
            )}

            <div className="flex items-center justify-between mt-3">
              <button onClick={() => setStage("age")} className="text-xs" style={{ color: "var(--ink-40)" }}>← back</button>
              <button onClick={signOut} className="text-xs" style={{ color: "var(--ink-40)" }}>Sign out</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
