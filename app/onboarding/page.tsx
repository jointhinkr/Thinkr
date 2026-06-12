"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidBetaCode } from "@/lib/beta";
import type { Fingerprint } from "@/lib/types";

const STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];

type Axis = "AK" | "OS" | "BR" | "LG" | "ND";
const QUESTIONS: { axis: Axis; a: { tag: string; t: string }; b: { tag: string; t: string } }[] = [
  { axis: "AK", a: { tag: "Ideas", t: "I'm pulled toward big, abstract ideas and what-ifs." }, b: { tag: "Reality", t: "I'm pulled toward concrete, practical, real things." } },
  { axis: "OS", a: { tag: "First instinct", t: "New idea? My gut says “this could actually work.”" }, b: { tag: "First instinct", t: "New idea? My gut says “what's the catch?”" } },
  { axis: "BR", a: { tag: "How I move", t: "I'd rather build something rough and ship it." }, b: { tag: "How I move", t: "I'd rather refine something until it's right." } },
  { axis: "LG", a: { tag: "My best thinking", t: "happens alone, in my own head." }, b: { tag: "My best thinking", t: "happens out loud, in conversation." } },
  { axis: "ND", a: { tag: "What hooks me", t: "Jumping between lots of new topics." }, b: { tag: "What hooks me", t: "Going deep on one thing for ages." } },
  { axis: "AK", a: { tag: "When I learn", t: "Give me the theory and the why first." }, b: { tag: "When I learn", t: "Give me a concrete example first." } },
  { axis: "OS", a: { tag: "I trust", t: "Optimism — betting on what could go right." }, b: { tag: "I trust", t: "Skepticism — stress-testing what could go wrong." } },
  { axis: "BR", a: { tag: "In a group", t: "I'm the one generating new options." }, b: { tag: "In a group", t: "I'm the one poking holes and improving them." } },
  { axis: "LG", a: { tag: "To recharge", t: "I need quiet time by myself." }, b: { tag: "To recharge", t: "I need time around people." } },
  { axis: "ND", a: { tag: "A good week", t: "is full of variety and new rabbit holes." }, b: { tag: "A good week", t: "is one long focused dive." } },
];

const TYPE_NAMES: Record<string, { name: string; line: string }> = {
  AB: { name: "The Visionary", line: "big-picture and bias-to-build — you see what could exist and start making it." },
  AR: { name: "The Theorist", line: "abstract and exacting — you chase the idea until the logic is airtight." },
  KB: { name: "The Maker", line: "grounded and hands-on — you turn real problems into real things, fast." },
  KR: { name: "The Craftsman", line: "practical and precise — you sweat the details until it's genuinely good." },
};

const flameBtn = { background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState<number | null>(null);
  const [betaChecked, setBetaChecked] = useState(false);
  const [betaCode, setBetaCode] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [matchGenders, setMatchGenders] = useState<string[]>([]);
  const [matchAge, setMatchAge] = useState<string | null>(null);
  const [stateUS, setStateUS] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [localTwin, setLocalTwin] = useState<boolean | null>(null);
  const [politics, setPolitics] = useState<string | null>(null);
  const [polLean, setPolLean] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(("a" | "b") | undefined)[]>(Array(QUESTIONS.length).fill(undefined));
  const [saving, setSaving] = useState(false);

  const stepKeys = (() => {
    const s = ["intro", "you", "prefGender", "prefAge", "location", "politics"];
    if (politics === "include") s.push("polLean");
    for (let i = 0; i < QUESTIONS.length; i++) s.push("q" + i);
    s.push("result");
    return s;
  })();
  const key = stepKeys[Math.min(step, stepKeys.length - 1)];
  const total = stepKeys.length - 1;
  const go = (n: number) => setStep((p) => Math.max(0, Math.min(p + n, stepKeys.length - 1)));

  function scores(): Record<Axis, number> {
    const acc: Record<Axis, [number, number]> = { AK: [0, 0], OS: [0, 0], BR: [0, 0], LG: [0, 0], ND: [0, 0] };
    QUESTIONS.forEach((q, i) => { acc[q.axis][1]++; if (answers[i] === "a") acc[q.axis][0]++; });
    const out = {} as Record<Axis, number>;
    (Object.keys(acc) as Axis[]).forEach((k) => { out[k] = acc[k][1] ? acc[k][0] / acc[k][1] : 0.5; });
    return out;
  }

  async function finish() {
    setSaving(true);
    const s = scores();
    const fingerprint: Fingerprint = {
      abstract_vs_concrete: s.AK,
      optimist_vs_skeptic: s.OS,
      builder_vs_critic: s.BR,
      solo_vs_social: s.LG,
      novelty_vs_depth: s.ND,
    };
    const letAK = s.AK >= 0.5 ? "A" : "K";
    const letBR = s.BR >= 0.5 ? "B" : "R";
    const typeName = (TYPE_NAMES[letAK + letBR] || { name: "The Original" }).name;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const isMinor = age != null && age < 18;
    const stateVal = stateUS === "undisclosed" ? null : stateUS;
    const regionVal = region === "undisclosed" ? null : region;
    await supabase.from("profiles").update({
      fingerprint, age, gender, state: stateVal, region: regionVal, city: stateVal, thinking_type: typeName,
      ...(isMinor ? { beta_tester: true } : {}),
    }).eq("id", user.id);
    await supabase.from("match_prefs").upsert({
      user_id: user.id,
      match_genders: matchGenders,
      match_age: matchAge,
      local_twin: localTwin,
      politics_include: politics === "include",
      political_lean: polLean,
    });
    router.push("/flux");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-4 pt-6 pb-16" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-[560px]">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display italic text-[19px]" style={{ color: "var(--flame)", fontWeight: 600 }}>Thinkr</span>
          <span className="font-label" style={{ fontSize: "11px", color: "var(--ink-40)" }}>
            {key === "intro" || key === "result" ? "" : `Step ${step} of ${total - 1}`}
          </span>
        </div>
        <div className="h-[5px] rounded-full overflow-hidden mb-7" style={{ background: "var(--line)" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round((step / (stepKeys.length - 1)) * 100)}%`, background: "linear-gradient(90deg, var(--amber), var(--flame))" }} />
        </div>

        <div className="rounded-[22px] px-6 py-7 animate-rise" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          {key === "intro" && <Intro onStart={() => go(1)} />}
          {key === "you" && <YouStep {...{ age, setAge, gender, setGender, betaChecked, setBetaChecked, betaCode, setBetaCode }} onBack={() => go(-1)} onNext={() => go(1)} />}
          {key === "prefGender" && <PrefGender {...{ matchGenders, setMatchGenders }} onBack={() => go(-1)} onNext={() => go(1)} />}
          {key === "prefAge" && <PrefAge {...{ age, matchAge, setMatchAge }} onBack={() => go(-1)} onNext={() => go(1)} />}
          {key === "location" && <LocationStep {...{ stateUS, setStateUS, region, setRegion, localTwin, setLocalTwin }} onBack={() => go(-1)} onNext={() => go(1)} />}
          {key === "politics" && <PoliticsStep {...{ politics, setPolitics, setPolLean }} onBack={() => go(-1)} onNext={() => go(1)} />}
          {key === "polLean" && <PolLean {...{ polLean, setPolLean }} onBack={() => go(-1)} onNext={() => go(1)} />}
          {key[0] === "q" && key !== "intro" && (
            <QuestionStep
              i={parseInt(key.slice(1), 10)}
              answers={answers}
              setAnswer={(i, v) => setAnswers((a) => { const n = [...a]; n[i] = v; return n; })}
              onBack={() => go(-1)} onNext={() => go(1)}
            />
          )}
          {key === "result" && <Result scores={scores()} onFinish={finish} saving={saving} onRetake={() => setStep(0)} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-label mb-3" style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--flame)" }}>{children}</div>;
}
function Nav({ onBack, onNext, disabled, label = "Continue", saving }: { onBack?: () => void; onNext: () => void; disabled?: boolean; label?: string; saving?: boolean }) {
  return (
    <div className="flex gap-2.5 mt-6">
      {onBack && <button onClick={onBack} className="px-5 py-3.5 rounded-full text-sm font-semibold" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>Back</button>}
      <button onClick={onNext} disabled={disabled || saving} className="flex-1 px-6 py-3.5 rounded-full text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-40" style={flameBtn}>
        {saving ? "…" : label}
      </button>
    </div>
  );
}
function Choice({ selected, round, onClick, children }: { selected: boolean; round?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full text-left px-4 py-3.5 text-[16px] transition-all"
      style={{ background: selected ? "#FFF6EC" : "#fff", border: `1.5px solid ${selected ? "var(--flame)" : "var(--line)"}`, borderRadius: round ? "14px" : "14px", color: "var(--ink-1)" }}>
      <span className="grid place-items-center shrink-0 text-white" style={{ width: 20, height: 20, borderRadius: round ? "50%" : "6px", border: `1.5px solid ${selected ? "var(--flame)" : "var(--line)"}`, background: selected ? "var(--flame)" : "transparent", fontSize: 12 }}>
        {selected ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 mt-4 px-3.5 py-3 rounded-xl text-[14px]" style={{ background: "#FFF6EC", border: "1px solid var(--amber)", color: "var(--ink-60)", lineHeight: 1.45 }}>
      <span style={{ color: "var(--flame)", fontWeight: 700 }}>⚑</span>
      <div>{children}</div>
    </div>
  );
}
const fldStyle: React.CSSProperties = { width: "100%", background: "#fff", border: "1.5px solid var(--line)", borderRadius: 12, padding: "13px 15px", fontSize: 16, color: "var(--ink-1)", marginTop: 8 };
const h2 = "font-display text-[clamp(21px,4.6vw,26px)] leading-tight";
const h1 = "font-display text-[clamp(26px,6vw,34px)] leading-[1.1]";

/* ---------- steps ---------- */
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <Eyebrow>2 minutes · the essential map</Eyebrow>
      <h1 className={h1} style={{ fontWeight: 600 }}>What&apos;s your thinking fingerprint?</h1>
      <p className="mt-3 text-[16px]" style={{ color: "var(--ink-60)" }}>
        Answer honestly and we&apos;ll map how you think — then pair you with the people whose minds are closest to yours. Not by looks. Not by location. By how you actually think.
      </p>
      <button onClick={onStart} className="mt-6 w-full px-6 py-3.5 rounded-full text-sm font-semibold text-white" style={flameBtn}>Start →</button>
    </div>
  );
}

function YouStep({ age, setAge, gender, setGender, betaChecked, setBetaChecked, betaCode, setBetaCode, onBack, onNext }: { age: number | null; setAge: (n: number | null) => void; gender: string | null; setGender: (s: string) => void; betaChecked: boolean; setBetaChecked: (b: boolean) => void; betaCode: string; setBetaCode: (s: string) => void; onBack: () => void; onNext: () => void }) {
  const minor = age != null && age < 18;
  const codeValid = isValidBetaCode(betaCode);
  // Under-18s may only be here as authorized beta testers — re-confirm the code.
  const betaOk = !minor || (betaChecked && codeValid);
  return (
    <div>
      <Eyebrow>A little about you</Eyebrow>
      <h2 className={h2} style={{ fontWeight: 600 }}>First, the basics.</h2>
      <label className="block font-semibold text-[15px] mt-5">How old are you?</label>
      <input type="number" min={13} max={120} placeholder="e.g. 21" value={age ?? ""} onChange={(e) => setAge(e.target.value ? parseInt(e.target.value, 10) : null)} style={fldStyle} />
      {minor && (
        <div className="mt-4 rounded-xl p-4" style={{ background: "#FFF6EC", border: "1px solid var(--amber)" }}>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={betaChecked} onChange={(e) => setBetaChecked(e.target.checked)} className="mt-0.5 accent-orange-600 w-4 h-4" />
            <span className="text-[13.5px]" style={{ color: "var(--ink-1)", lineHeight: 1.5 }}>
              I&apos;m an authorized Thinkr beta tester under 18 with an official access code. I understand I&apos;ll only ever
              be matched with other under-18 testers.
            </span>
          </label>
          <label className="block font-semibold text-[13px] mt-3 mb-1.5" style={{ color: "var(--ink-1)" }}>Re-enter your beta access code</label>
          <input type="text" value={betaCode} onChange={(e) => setBetaCode(e.target.value)} autoComplete="off" placeholder="BETA-XXX-XXXX-XXXXXX" disabled={!betaChecked}
            className="w-full rounded-xl px-4 py-2.5 text-[15px] tracking-wider disabled:opacity-50"
            style={{ background: "#fff", border: `1.5px solid ${betaCode && !codeValid ? "#dc2626" : "var(--line)"}`, color: "var(--ink-1)" }} />
          {betaCode.length > 0 && !codeValid && <p className="text-[12px] mt-1.5" style={{ color: "#dc2626" }}>That code isn&apos;t valid.</p>}
          {betaOk && minor && <p className="text-[12px] mt-1.5" style={{ color: "var(--flame)", fontWeight: 600 }}>✓ Verified — you&apos;ll match only with other under-18 testers.</p>}
        </div>
      )}
      <label className="block font-semibold text-[15px] mt-5 mb-2">Your gender</label>
      <div className="flex flex-col gap-2.5">
        {[["female", "Female"], ["male", "Male"], ["nonid", "Prefer not to identify"]].map(([v, l]) => (
          <Choice key={v} round selected={gender === v} onClick={() => setGender(v)}>{l}</Choice>
        ))}
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={!(age && age >= 13 && gender && betaOk)} />
    </div>
  );
}

function PrefGender({ matchGenders, setMatchGenders, onBack, onNext }: { matchGenders: string[]; setMatchGenders: (s: string[]) => void; onBack: () => void; onNext: () => void }) {
  function toggle(v: string) {
    if (v === "any") setMatchGenders(matchGenders.includes("any") ? [] : ["any"]);
    else {
      const base = matchGenders.filter((x) => x !== "any");
      setMatchGenders(base.includes(v) ? base.filter((x) => x !== v) : [...base, v]);
    }
  }
  return (
    <div>
      <Eyebrow>Who you&apos;d like to meet</Eyebrow>
      <h2 className={h2} style={{ fontWeight: 600 }}>Open to matching with…</h2>
      <p className="mt-2 text-[15px]" style={{ color: "var(--ink-60)" }}>Pick any that feel right — you can choose more than one.</p>
      <div className="flex flex-col gap-2.5 mt-5">
        {[["female", "Women"], ["male", "Men"], ["nonid", "Non-identified"], ["any", "Anyone"]].map(([v, l]) => (
          <Choice key={v} selected={matchGenders.includes(v)} onClick={() => toggle(v)}>{l}</Choice>
        ))}
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={matchGenders.length === 0} />
    </div>
  );
}

function PrefAge({ age, matchAge, setMatchAge, onBack, onNext }: { age: number | null; matchAge: string | null; setMatchAge: (s: string) => void; onBack: () => void; onNext: () => void }) {
  const minor = age != null && age < 18;
  const opts = minor
    ? [["teen_same", "Someone the same age as me"], ["teen_under18", "Anyone under 18"]]
    : [["same", "Around my age (±2 years)"], ["within5", "Within 5 years of me"], ["18-22", "18–22"], ["23-29", "23–29"], ["30s", "30s"], ["40+", "40+"], ["anyadult", "Any age (18+)"]];
  return (
    <div>
      <Eyebrow>Who you&apos;d like to meet</Eyebrow>
      <h2 className={h2} style={{ fontWeight: 600 }}>Age range for your matches</h2>
      <div className="flex flex-col gap-2.5 mt-5">
        {opts.map(([v, l]) => <Choice key={v} round selected={matchAge === v} onClick={() => setMatchAge(v)}>{l}</Choice>)}
      </div>
      <Note>For everyone&apos;s safety, matching never crosses the 18 line. {minor ? "As an under-18 beta tester, you'll only ever be matched with other under-18 testers." : "“Any age” means any adult — adults are never matched with minors."}</Note>
      <Nav onBack={onBack} onNext={onNext} disabled={!matchAge} />
    </div>
  );
}

function LocationStep({ stateUS, setStateUS, region, setRegion, localTwin, setLocalTwin, onBack, onNext }: { stateUS: string | null; setStateUS: (s: string) => void; region: string | null; setRegion: (s: string) => void; localTwin: boolean | null; setLocalTwin: (b: boolean) => void; onBack: () => void; onNext: () => void }) {
  const undisclosed = stateUS === "undisclosed";
  function toggleUndisclosed() {
    if (undisclosed) { setStateUS(""); setRegion(""); }
    else { setStateUS("undisclosed"); setRegion("undisclosed"); setLocalTwin(false); }
  }
  return (
    <div>
      <Eyebrow>Where you are</Eyebrow>
      <h2 className={h2} style={{ fontWeight: 600 }}>Your location</h2>
      <p className="mt-2 text-[15px]" style={{ color: "var(--ink-60)" }}>We use this only to offer local matches if you want them — and you can keep it private.</p>

      <div className="mt-4">
        <Choice round selected={undisclosed} onClick={toggleUndisclosed}>Prefer not to disclose my location</Choice>
      </div>

      {!undisclosed ? (
        <>
          <label className="block font-semibold text-[15px] mt-4">State</label>
          <select value={stateUS ?? ""} onChange={(e) => setStateUS(e.target.value)} style={fldStyle}>
            <option value="">Choose a state…</option>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="block font-semibold text-[15px] mt-4">Region of your state</label>
          <select value={region ?? ""} onChange={(e) => setRegion(e.target.value)} style={fldStyle}>
            {["", "Northern", "Southern", "Eastern", "Western", "Central", "Major city / metro"].map((r) => <option key={r} value={r}>{r || "Choose a region…"}</option>)}
          </select>
          <label className="block font-semibold text-[15px] mt-4 mb-2">Want a local Thought Twin?</label>
          <div className="flex flex-col gap-2.5">
            {[[true, "Yes — prioritise people near me"], [false, "No — match me with the best mind anywhere"]].map(([v, l]) => (
              <Choice key={String(v)} round selected={localTwin === v} onClick={() => setLocalTwin(v as boolean)}>{l as string}</Choice>
            ))}
          </div>
        </>
      ) : (
        <Note>Your location stays private. We&apos;ll match you on how you think — anywhere. Local matching is off.</Note>
      )}

      <Nav onBack={onBack} onNext={onNext} disabled={undisclosed ? false : !(stateUS && region && localTwin !== null)} />
    </div>
  );
}

function PoliticsStep({ politics, setPolitics, setPolLean, onBack, onNext }: { politics: string | null; setPolitics: (s: string) => void; setPolLean: (s: string | null) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div>
      <Eyebrow>One sensitive one</Eyebrow>
      <h2 className={h2} style={{ fontWeight: 600 }}>Should politics factor into your matches?</h2>
      <p className="mt-2 text-[15px]" style={{ color: "var(--ink-60)" }}>Some people want to meet others who see the world similarly; others would rather it never come up. Your call.</p>
      <div className="flex flex-col gap-2.5 mt-5">
        {[["include", "Yes — include political alignment"], ["exclude", "No — leave politics out of it"]].map(([v, l]) => (
          <Choice key={v} round selected={politics === v} onClick={() => { if (v !== "include") setPolLean(null); setPolitics(v); }}>{l}</Choice>
        ))}
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={!politics} />
    </div>
  );
}

function PolLean({ polLean, setPolLean, onBack, onNext }: { polLean: string | null; setPolLean: (s: string) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div>
      <Eyebrow>Politics</Eyebrow>
      <h2 className={h2} style={{ fontWeight: 600 }}>Where do you land, roughly?</h2>
      <p className="mt-2 text-[15px]" style={{ color: "var(--ink-60)" }}>Only used to weight matches — never shown publicly.</p>
      <div className="flex flex-col gap-2.5 mt-5">
        {[["left", "Left"], ["center-left", "Center-left"], ["center", "Center"], ["center-right", "Center-right"], ["right", "Right"]].map(([v, l]) => (
          <Choice key={v} round selected={polLean === v} onClick={() => setPolLean(v)}>{l}</Choice>
        ))}
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={!polLean} />
    </div>
  );
}

function QuestionStep({ i, answers, setAnswer, onBack, onNext }: { i: number; answers: (("a" | "b") | undefined)[]; setAnswer: (i: number, v: "a" | "b") => void; onBack: () => void; onNext: () => void }) {
  const q = QUESTIONS[i];
  const sel = answers[i];
  return (
    <div>
      <div className="font-label mb-3" style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}>{q.a.tag}</div>
      <div className="font-display text-[22px] leading-tight mb-1" style={{ fontWeight: 600 }}>Which is more you?</div>
      <div className="flex flex-col gap-3 mt-5">
        {(["a", "b"] as const).map((opt) => {
          const o = q[opt];
          const on = sel === opt;
          return (
            <button key={opt} onClick={() => setAnswer(i, opt)} className="text-left p-4 transition-all"
              style={{ borderRadius: 16, background: on ? "#FFF6EC" : "#fff", border: `1.5px solid ${on ? "var(--flame)" : "var(--line)"}` }}>
              <span className="font-label block mb-1.5" style={{ fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--flame)" }}>{o.tag}</span>
              <span className="text-[17px] font-medium" style={{ color: "var(--ink-1)" }}>{o.t}</span>
            </button>
          );
        })}
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={!sel} label={i === QUESTIONS.length - 1 ? "See my result →" : "Next"} />
    </div>
  );
}

function Result({ scores: s, onFinish, saving, onRetake }: { scores: Record<Axis, number>; onFinish: () => void; saving: boolean; onRetake: () => void }) {
  const letAK = s.AK >= 0.5 ? "A" : "K";
  const letBR = s.BR >= 0.5 ? "B" : "R";
  const type = TYPE_NAMES[letAK + letBR] || { name: "The Original", line: "a one-of-a-kind mix." };
  const code = [s.AK >= 0.5 ? "A" : "K", s.OS >= 0.5 ? "O" : "S", s.BR >= 0.5 ? "B" : "R", s.LG >= 0.5 ? "L" : "G", s.ND >= 0.5 ? "N" : "D"].join("·");
  const bias = (v: number, hi: string, lo: string) => (v >= 0.5 ? hi : lo);
  const desc = `You're ${bias(s.AK, "drawn to ideas", "grounded in reality")}, ${bias(s.OS, "an optimist at the core", "a careful skeptic")}, ${bias(s.LG, "who thinks best alone", "who thinks best with others")}. ${type.line.charAt(0).toUpperCase()}${type.line.slice(1)}`;
  const Axis = ({ l0, l1, v }: { l0: string; l1: string; v: number }) => (
    <div>
      <div className="flex justify-between font-label mb-1.5" style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-40)" }}><span>{l0}</span><span>{l1}</span></div>
      <div className="h-2 rounded-full relative" style={{ background: "var(--line)" }}>
        <i className="absolute rounded-full transition-all duration-700" style={{ top: -4, width: 16, height: 16, background: "var(--flame)", boxShadow: "0 0 0 4px #FFF6EC", left: `${Math.round((1 - v) * 100)}%`, transform: "translateX(-50%)" }} />
      </div>
    </div>
  );
  return (
    <div>
      <Eyebrow>Your thinking fingerprint</Eyebrow>
      <h1 className={h1} style={{ fontWeight: 600 }}>{type.name}</h1>
      <div className="font-label mt-1.5" style={{ letterSpacing: "0.18em", color: "var(--flame)", fontSize: 14 }}>{code}</div>
      <p className="mt-4 text-[16.5px]" style={{ color: "var(--ink-1)" }}>{desc}</p>
      <div className="flex flex-col gap-4 mt-6">
        <Axis l0="Ideas" l1="Practical" v={s.AK} />
        <Axis l0="Optimist" l1="Skeptic" v={s.OS} />
        <Axis l0="Builder" l1="Refiner" v={s.BR} />
        <Axis l0="Solo" l1="Social" v={s.LG} />
        <Axis l0="Explorer" l1="Deep-diver" v={s.ND} />
      </div>
      <div className="mt-6 rounded-[18px] p-6 text-center" style={{ background: "var(--flame)", color: "var(--cream)" }}>
        <div className="font-display text-[22px] leading-tight">Now meet the minds closest to yours.</div>
        <div className="text-[14px] mt-2" style={{ opacity: 0.92 }}>Your fingerprint is set. Thinkr will pair you with your Thought Twin.</div>
        <button onClick={onFinish} disabled={saving} className="mt-4 w-full px-6 py-3.5 rounded-full text-[16px] font-semibold disabled:opacity-60" style={{ background: "var(--amber)", color: "var(--ink-1)" }}>
          {saving ? "Setting up…" : "Enter Thinkr →"}
        </button>
      </div>
      <div className="mt-4">
        <button onClick={onRetake} className="w-full px-6 py-3 rounded-full text-sm font-semibold" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>Retake</button>
      </div>
    </div>
  );
}
