"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [stage, setStage] = useState<"age" | "terms" | "blocked">("age");
  const [agree, setAgree] = useState(false);
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

  function continueFromAge() {
    if (age == null) return;
    if (age < 18) setStage("blocked");
    else setStage("terms");
  }

  async function accept() {
    if (!agree || age == null) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("profiles").update({
      age_verified: true,
      terms_accepted_at: new Date().toISOString(),
      age,
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
      <div className="w-full max-w-[440px] rounded-[24px] p-6 animate-rise"
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
              Thinkr verifies age to keep the community safe. We store only whether you&apos;re 18+, never your date of birth.
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
            <div className="mt-4 rounded-xl p-4 text-[13px] max-h-44 overflow-y-auto"
              style={{ background: "var(--cream)", border: "1px solid var(--line)", color: "var(--ink-60)", lineHeight: 1.55 }}>
              <p style={{ fontStyle: "italic" }}>Thinkr&apos;s full Terms of Service and Privacy Policy are being finalized and will be published here before launch.</p>
              <p className="mt-2">In summary: you&apos;re 18 or older; you&apos;ll be kind; your private data (email, password, political lean, match preferences) is encrypted and never sold; no public vanity metrics; you can delete your account and data anytime.</p>
              <p className="mt-2 opacity-70">[Full legal text — placeholder, to be added.]</p>
            </div>
            <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-orange-600 w-4 h-4" />
              <span className="text-[14px]" style={{ color: "var(--ink-1)" }}>I&apos;m 18 or older and I agree to the Terms &amp; Privacy Policy.</span>
            </label>
            <button onClick={accept} disabled={!agree || saving}
              className="mt-5 w-full px-6 py-3.5 rounded-full text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
              {saving ? "Entering…" : "Agree & enter Thinkr"}
            </button>
            <button onClick={() => setStage("age")} className="mt-2 w-full text-xs" style={{ color: "var(--ink-40)" }}>back</button>
          </>
        )}

        {stage === "blocked" && (
          <>
            <div className="text-3xl mb-2">🌱</div>
            <h2 className="font-display text-[24px] leading-tight" style={{ fontWeight: 600, color: "var(--ink-1)" }}>
              A teen Thinkr is on the way.
            </h2>
            <p className="mt-2 text-[15px]" style={{ color: "var(--ink-60)" }}>
              For everyone&apos;s safety, the current experience is 18+. We&apos;re building a separate, protected space for under-18 thinkers — under-18s are only ever matched with other teens. We&apos;ll let you know the moment it opens.
            </p>
            <button onClick={signOut}
              className="mt-6 w-full px-6 py-3.5 rounded-full text-sm font-semibold"
              style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
