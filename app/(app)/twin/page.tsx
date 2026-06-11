"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findThoughtTwin } from "@/lib/matching";
import type { Profile, MatchPrefs } from "@/lib/types";

// Plain-language labels for each thinking axis (the survey jargon was confusing).
const AXES = [
  { key: "abstract_vs_concrete", left: "Ideas", right: "Practical", note: "abstract concepts ↔ concrete reality" },
  { key: "optimist_vs_skeptic", left: "Optimist", right: "Skeptic", note: "what could go right ↔ what could go wrong" },
  { key: "builder_vs_critic", left: "Builder", right: "Refiner", note: "makes new things ↔ perfects them" },
  { key: "solo_vs_social", left: "Solo", right: "Social", note: "thinks alone ↔ thinks out loud" },
  { key: "novelty_vs_depth", left: "Explorer", right: "Deep-diver", note: "many new topics ↔ one thing, deeply" },
] as const;

const STEPS = [
  "Reading your thinking fingerprint…",
  "Comparing how you think against every other mind…",
  "Weighing your match preferences…",
  "Surfacing the mind closest to yours…",
];

function ageBounds(tag: string): [number, number] {
  switch (tag) {
    case "teen": return [13, 17];
    case "18-22": return [18, 22];
    case "23-29": return [23, 29];
    case "30s": return [30, 39];
    case "40+": return [40, 200];
    case "anyadult": return [18, 200];
    default: return [0, 200];
  }
}
function gateCandidates(me: Profile, candidates: Profile[], prefs: MatchPrefs | null): Profile[] {
  return candidates.filter((c) => {
    if (typeof me.age === "number" && typeof c.age === "number" && (me.age < 18) !== (c.age < 18)) return false;
    if (prefs) {
      const mg = prefs.match_genders ?? [];
      if (mg.length && !mg.includes("any") && c.gender && !mg.includes(c.gender)) return false;
      if (prefs.match_age && typeof c.age === "number") {
        const [lo, hi] = ageBounds(prefs.match_age);
        if (c.age < lo || c.age > hi) return false;
      }
    }
    return true;
  });
}
const fingerprintDone = (p: Profile | null) => !!p && Object.keys(p.fingerprint ?? {}).length > 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "loading" | "gate" | "analyzing" | "result" | "none";

export default function TwinPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [twin, setTwin] = useState<{ profile: Profile; score: number } | null>(null);
  const [step, setStep] = useState(0);
  const [conn, setConn] = useState<{ state: "none" | "sent" | "incoming" | "bonded"; reqId?: string }>({ state: "none" });
  const [connBusy, setConnBusy] = useState(false);

  const meRef = useRef<Profile | null>(null);
  const meId = useRef<string | null>(null);
  const candidatesRef = useRef<Profile[]>([]);
  const prefsRef = useRef<MatchPrefs | null>(null);
  const excludedRef = useRef<string[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("gate"); return; }
      meId.current = user.id;

      const { data: myProfile } = await supabase.from("profiles").select().eq("id", user.id).single();
      meRef.current = myProfile;

      if (!fingerprintDone(myProfile)) { setPhase("gate"); return; }

      const { data: prefs } = await supabase.from("match_prefs").select().eq("user_id", user.id).maybeSingle();
      prefsRef.current = (prefs as MatchPrefs | null) ?? null;
      const { data: allProfiles } = await supabase.from("profiles").select().neq("id", user.id);
      candidatesRef.current = (allProfiles as Profile[]) ?? [];

      runMatch();
    })();
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runMatch() {
    const me = meRef.current;
    if (!me) return;
    setPhase("analyzing");
    setTwin(null);
    setConn({ state: "none" });
    for (let s = 0; s < STEPS.length; s++) {
      if (!alive.current) return;
      setStep(s);
      await sleep(720);
    }
    if (!alive.current) return;

    const excluded = excludedRef.current;
    let pool = gateCandidates(me, candidatesRef.current, prefsRef.current).filter((c) => !excluded.includes(c.id));
    if (!pool.length) pool = candidatesRef.current.filter((c) => !excluded.includes(c.id));
    if (prefsRef.current?.local_twin && me.state) {
      const local = pool.filter((c) => c.state === me.state);
      if (local.length) pool = local;
    }
    const result = findThoughtTwin(me, pool);
    if (!result) { setPhase("none"); return; }

    const supabase = createClient();
    await supabase.from("matches").upsert(
      { user_a: me.id, user_b: result.profile.id, score: result.score },
      { onConflict: "user_a,user_b" }
    );
    const { data: reqRow } = await supabase
      .from("connection_requests").select("id, requester_id, status")
      .or(`and(requester_id.eq.${me.id},addressee_id.eq.${result.profile.id}),and(requester_id.eq.${result.profile.id},addressee_id.eq.${me.id})`)
      .maybeSingle();
    let c: typeof conn = { state: "none" };
    if (reqRow) {
      if (reqRow.status === "accepted") c = { state: "bonded" };
      else if (reqRow.requester_id === me.id) c = { state: "sent" };
      else c = { state: "incoming", reqId: reqRow.id };
    }
    if (!alive.current) return;
    setTwin(result);
    setConn(c);
    setPhase("result");
  }

  function findAnother() {
    if (twin) excludedRef.current = [...excludedRef.current, twin.profile.id];
    runMatch();
  }

  async function sendConnect() {
    if (!twin || !meId.current) return;
    setConnBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("connection_requests").insert({ requester_id: meId.current, addressee_id: twin.profile.id });
    if (!error) setConn({ state: "sent" });
    setConnBusy(false);
  }
  async function approveConnect() {
    if (!conn.reqId) return;
    setConnBusy(true);
    const supabase = createClient();
    await supabase.rpc("respond_to_connection", { req: conn.reqId, accept: true });
    setConn({ state: "bonded" });
    setConnBusy(false);
  }
  async function openChat() {
    if (!twin) return;
    setConnBusy(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("start_direct_conversation", { other: twin.profile.id });
    setConnBusy(false);
    if (data) router.push(`/echo/${data}`);
  }

  const me = meRef.current;

  return (
    <div className="space-y-6">
      <div>
        <span className="label-xs">Thought Twin</span>
        <h1 className="font-display text-3xl mt-0.5" style={{ color: "var(--ink-1)" }}>Your closest mind</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>
          Matched by how your minds actually work — not by looks, location, or what you post.
        </p>
      </div>

      {phase === "loading" && <div className="h-40 rounded-2xl skeleton" />}

      {/* GATE — must take the questionnaire first */}
      {phase === "gate" && (
        <div className="rounded-2xl p-7 text-center animate-rise" style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
          <div className="text-3xl mb-2">🧭</div>
          <h2 className="font-display text-2xl" style={{ color: "var(--ink-1)" }}>It starts with your fingerprint.</h2>
          <p className="text-sm mt-2 mb-1" style={{ color: "var(--ink-60)" }}>
            Thought Twin matching only works once we know how you think. Take the short questionnaire and our algorithm will start finding the mind closest to yours — then keep refining it as you post.
          </p>
          <p className="text-xs mb-6" style={{ color: "var(--ink-40)" }}>~2 minutes · 15 questions · no right answers</p>
          <Link href="/onboarding" className="inline-block px-6 py-3.5 rounded-full text-white text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
            Take the questionnaire →
          </Link>
        </div>
      )}

      {/* ANALYZING — the process */}
      {phase === "analyzing" && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
          <div className="mx-auto mb-5 w-14 h-14 rounded-full grid place-items-center"
            style={{ background: "rgba(244,74,38,0.1)" }}>
            <div className="w-7 h-7 rounded-full" style={{ border: "2.5px solid var(--flame)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          </div>
          <div className="font-display italic text-lg mb-5" style={{ color: "var(--ink-1)" }}>{STEPS[step]}</div>
          <div className="h-1.5 max-w-xs mx-auto rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "linear-gradient(90deg, var(--amber), var(--flame))" }} />
          </div>
          <p className="text-xs mt-5" style={{ color: "var(--ink-40)" }}>Comparing {candidatesRef.current.length} thinkers…</p>
        </div>
      )}

      {phase === "none" && (
        <div className="rounded-2xl p-7 text-center" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-3xl mb-2">🧠</div>
          <p className="font-medium" style={{ color: "var(--ink-1)" }}>No match yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>
            You need at least one other thinker who&apos;s taken the questionnaire. Keep posting — we&apos;ll keep matching as more minds join.
          </p>
          <button onClick={() => { excludedRef.current = []; runMatch(); }} className="mt-5 px-5 py-2.5 rounded-full text-sm font-semibold" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>
            Try again
          </button>
        </div>
      )}

      {/* RESULT */}
      {phase === "result" && twin && me && (
        <>
          <div className="rounded-2xl overflow-hidden animate-rise" style={{ background: "var(--flame)" }}>
            <div className="px-6 py-6 text-white">
              <div className="label-xs mb-3" style={{ color: "rgba(255,255,255,0.8)" }}>
                {Math.round(twin.score * 100)}% THINKING ALIGNMENT
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full grid place-items-center text-2xl font-bold" style={{ background: "rgba(0,0,0,0.15)" }}>
                  {(twin.profile.display_name || twin.profile.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xl font-medium font-display">{twin.profile.display_name || twin.profile.username}</div>
                  <div className="text-sm opacity-80">@{twin.profile.username}</div>
                  {twin.profile.bio && <div className="text-sm opacity-90 mt-1">{twin.profile.bio}</div>}
                </div>
              </div>
              <div className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.85)" }}>
                Your closest mind <em>right now</em> — we keep refining this as you both post more.
              </div>
            </div>
          </div>

          <div className="rounded-2xl px-5 py-5 space-y-4" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            <div className="label-xs">How you both think</div>
            {AXES.map((ax) => {
              const myVal = (me.fingerprint?.[ax.key] as number) ?? 0.5;
              const twinVal = (twin.profile.fingerprint?.[ax.key] as number) ?? 0.5;
              return (
                <div key={ax.key} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium" style={{ color: "var(--ink-1)" }}>
                    <span>{ax.left}</span><span>{ax.right}</span>
                  </div>
                  <div className="text-[10px] text-center" style={{ color: "var(--ink-40)" }}>{ax.note}</div>
                  {[{ v: myVal, c: "var(--flame)", who: "you" }, { v: twinVal, c: "var(--amber)", who: "them" }].map((row) => (
                    <div key={row.who} className="flex items-center gap-2">
                      <span className="text-[10px] w-7" style={{ color: "var(--ink-40)" }}>{row.who}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(28,20,11,0.08)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.round(row.v * 100)}%`, background: row.c }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <button
            onClick={conn.state === "bonded" ? openChat : conn.state === "incoming" ? approveConnect : conn.state === "sent" ? undefined : sendConnect}
            disabled={connBusy || conn.state === "sent"}
            className="block w-full text-center py-3.5 rounded-2xl font-semibold text-sm text-white transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
            {connBusy ? "…"
              : conn.state === "bonded" ? "Message your twin →"
              : conn.state === "incoming" ? "Approve the bond →"
              : conn.state === "sent" ? "Request sent ✓"
              : "✦ Request to connect"}
          </button>

          <Link href={`/profile/${twin.profile.username}`} className="block w-full text-center py-3 rounded-xl font-medium text-sm border-2"
            style={{ borderColor: "var(--flame)", color: "var(--flame)" }}>
            View their thoughts →
          </Link>

          <div className="rounded-2xl px-5 py-4 text-center space-y-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            <button onClick={findAnother} disabled={connBusy} className="w-full py-2.5 rounded-full text-sm font-semibold"
              style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-1)" }}>
              ⟳ Find another Thought Twin
            </button>
            <p className="text-xs" style={{ color: "var(--ink-40)" }}>
              We&apos;ll start a fresh match and surface your next-closest mind. Keep posting and we&apos;ll keep matching.
            </p>
            <Link href="/onboarding" className="inline-block text-xs font-medium" style={{ color: "var(--flame)" }}>
              Want to edit your questionnaire answers? →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
