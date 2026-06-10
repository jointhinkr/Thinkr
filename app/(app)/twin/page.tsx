"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findThoughtTwin } from "@/lib/matching";
import type { Profile, MatchPrefs } from "@/lib/types";

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

// Gate candidates by the survey's match preferences BEFORE the similarity algorithm runs.
// Lenient: candidates missing a field aren't excluded — except the hard 18-line safety rule.
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

const AXIS_LABELS: Record<string, [string, string]> = {
  abstract_vs_concrete: ["Abstract", "Concrete"],
  optimist_vs_skeptic: ["Optimist", "Skeptic"],
  builder_vs_critic: ["Builder", "Critic"],
  solo_vs_social: ["Solo", "Social"],
  novelty_vs_depth: ["Novelty", "Depth"],
};

function FingerprintBar({ axis, value }: { axis: string; value: number }) {
  const [left, right] = AXIS_LABELS[axis] ?? [axis, ""];
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs opacity-50">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--flame)" }}
        />
      </div>
    </div>
  );
}

export default function TwinPage() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [twin, setTwin] = useState<{ profile: Profile; score: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<{ state: "none" | "sent" | "incoming" | "bonded"; reqId?: string }>({ state: "none" });
  const [connBusy, setConnBusy] = useState(false);

  async function sendConnect() {
    if (!twin || !meId) return;
    setConnBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("connection_requests").insert({ requester_id: meId, addressee_id: twin.profile.id });
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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMeId(user.id);

      const { data: myProfile } = await supabase
        .from("profiles")
        .select()
        .eq("id", user.id)
        .single();
      setMe(myProfile);

      const { data: prefs } = await supabase
        .from("match_prefs").select().eq("user_id", user.id).maybeSingle();

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select()
        .neq("id", user.id);

      if (myProfile && allProfiles && allProfiles.length > 0) {
        const eligible = gateCandidates(myProfile, allProfiles, (prefs as MatchPrefs | null) ?? null);
        let pool = eligible.length ? eligible : allProfiles;
        if (prefs?.local_twin && myProfile.state) {
          const local = pool.filter((c) => c.state === myProfile.state);
          if (local.length) pool = local;
        }
        const result = findThoughtTwin(myProfile, pool);
        setTwin(result);

        if (result) {
          await supabase.from("matches").upsert(
            {
              user_a: user.id,
              user_b: result.profile.id,
              score: result.score,
            },
            { onConflict: "user_a,user_b" }
          );

          const { data: reqRow } = await supabase
            .from("connection_requests")
            .select("id, requester_id, status")
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${result.profile.id}),and(requester_id.eq.${result.profile.id},addressee_id.eq.${user.id})`)
            .maybeSingle();
          if (reqRow) {
            if (reqRow.status === "accepted") setConn({ state: "bonded" });
            else if (reqRow.requester_id === user.id) setConn({ state: "sent" });
            else setConn({ state: "incoming", reqId: reqRow.id });
          }
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-20 opacity-30 text-sm">Finding your twin…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <span
          className="text-xs tracking-widest opacity-40"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          THOUGHT TWIN
        </span>
        <h1
          className="text-2xl mt-1"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Your closest thinker
        </h1>
        <p className="text-sm opacity-50 mt-1">
          Matched by how your minds work, not what you post.
        </p>
      </div>

      {!twin ? (
        <div className="rounded-2xl bg-white border border-black/6 px-6 py-10 text-center space-y-2">
          <p className="text-3xl">🧠</p>
          <p className="font-medium">No match yet</p>
          <p className="text-sm opacity-50">
            You need at least one other thinker on the platform to match with.
            Share Thinkr with someone whose mind you admire.
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--flame)" }}
          >
            <div className="px-6 py-6 text-white">
              <div
                className="text-xs tracking-widest opacity-70 mb-3"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {Math.round(twin.score * 100)}% THINKING ALIGNMENT
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: "rgba(0,0,0,0.15)" }}
                >
                  {(twin.profile.display_name || twin.profile.username)
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="text-xl font-medium" style={{ fontFamily: "'Fraunces', serif" }}>
                    {twin.profile.display_name || twin.profile.username}
                  </div>
                  <div className="text-sm opacity-70">@{twin.profile.username}</div>
                  {twin.profile.bio && (
                    <div className="text-sm opacity-80 mt-1">{twin.profile.bio}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-black/6 px-5 py-5 space-y-4">
            <div
              className="text-xs tracking-widest opacity-40"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              HOW YOU BOTH THINK
            </div>

            <div className="space-y-4">
              {Object.entries(AXIS_LABELS).map(([axis]) => {
                const myVal = (me?.fingerprint?.[axis] as number) ?? 0.5;
                const twinVal = (twin.profile.fingerprint?.[axis] as number) ?? 0.5;
                return (
                  <div key={axis} className="space-y-1">
                    <div
                      className="text-xs opacity-40 mb-1"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {axis.replace(/_vs_/g, " vs ").toUpperCase()}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs opacity-40 w-6">you</span>
                      <div className="flex-1">
                        <FingerprintBar axis={axis} value={myVal} />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs opacity-40 w-6">them</span>
                      <div className="flex-1">
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(twinVal * 100)}%`,
                                background: "var(--amber)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={conn.state === "bonded" ? openChat : conn.state === "incoming" ? approveConnect : conn.state === "sent" ? undefined : sendConnect}
            disabled={connBusy || conn.state === "sent"}
            className="block w-full text-center py-3.5 rounded-2xl font-semibold text-sm text-white transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}
          >
            {connBusy ? "…"
              : conn.state === "bonded" ? "Message your twin →"
              : conn.state === "incoming" ? "Approve the bond →"
              : conn.state === "sent" ? "Request sent ✓"
              : "✦ Request to connect"}
          </button>

          <Link
            href={`/profile/${twin.profile.username}`}
            className="block w-full text-center py-3 rounded-xl font-medium text-sm border-2 transition-colors hover:text-white"
            style={{
              borderColor: "var(--flame)",
              color: "var(--flame)",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--flame)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--flame)";
            }}
          >
            View their thoughts →
          </Link>
        </>
      )}
    </div>
  );
}
