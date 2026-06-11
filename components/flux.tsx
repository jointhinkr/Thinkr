"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import type { ThoughtWithMeta } from "@/lib/types";

const PALETTES = [
  { from: "#FFE3C2", via: "#FBD9B0", accent: "#F44A26", glow: "rgba(244,74,38,0.18)" },
  { from: "#FFE9CC", via: "#F7C77E", accent: "#C9821E", glow: "rgba(201,130,30,0.20)" },
  { from: "#FFD9CE", via: "#F8BFA8", accent: "#E5604B", glow: "rgba(229,96,75,0.18)" },
  { from: "#FBEFD8", via: "#F3D9A4", accent: "#B6791B", glow: "rgba(182,121,27,0.18)" },
  { from: "#FFDCC0", via: "#FFC58C", accent: "#F44A26", glow: "rgba(244,74,38,0.16)" },
];

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Particles({ accent }: { accent: string }) {
  const dots = [
    { t: "16%", l: "22%", s: 3, o: 0.5, d: "0s" },
    { t: "28%", l: "78%", s: 4, o: 0.35, d: "1.2s" },
    { t: "62%", l: "14%", s: 3, o: 0.45, d: "0.6s" },
    { t: "72%", l: "82%", s: 5, o: 0.3, d: "1.8s" },
    { t: "44%", l: "88%", s: 2, o: 0.5, d: "0.9s" },
    { t: "84%", l: "40%", s: 3, o: 0.35, d: "1.5s" },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            top: d.t, left: d.l, width: d.s, height: d.s,
            background: accent, opacity: d.o,
            animation: `pulse-dot 3.4s ease-in-out ${d.d} infinite`,
          }}
        />
      ))}
    </>
  );
}

function FluxSlide({
  t,
  palette,
  userId,
}: {
  t: ThoughtWithMeta;
  palette: (typeof PALETTES)[number];
  userId: string | null;
}) {
  const [resonated, setResonated] = useState(t.resonated);
  const [burst, setBurst] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = t.author.display_name || t.author.username;

  async function toggleResonance() {
    if (busy || !userId) return;
    setBusy(true);
    const next = !resonated;
    setResonated(next);
    if (next) { setBurst(true); setTimeout(() => setBurst(false), 650); }
    const supabase = createClient();
    if (next) {
      await supabase.from("resonances").insert({ user_id: userId, thought_id: t.id });
    } else {
      await supabase.from("resonances").delete().eq("user_id", userId).eq("thought_id", t.id);
    }
    setBusy(false);
  }

  function branch() {
    window.dispatchEvent(new CustomEvent("thinkr:compose", { detail: { parentId: t.id, parentBody: t.body } }));
  }

  async function share() {
    const text = `“${t.body}” — @${t.author.username} · via Thinkr`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setShared(true); setTimeout(() => setShared(false), 1600); }
    } catch { /* dismissed */ }
  }

  return (
    <section
      className="flux-slide relative snap-start shrink-0 w-full overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* warm gradient field */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 30% 18%, ${palette.from} 0%, ${palette.via} 42%, var(--cream) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 40% at 78% 82%, ${palette.glow} 0%, transparent 70%)`,
          animation: "aurora-drift 14s ease-in-out infinite",
        }}
      />
      <Particles accent={palette.accent} />

      {/* content */}
      <div
        className="relative h-full flex flex-col justify-center"
        style={{ padding: "calc(52px + 6vh) 22px calc(var(--nav-h) + 4vh)" }}
      >
        <Link href={`/profile/${t.author.username}`} className="flex items-center gap-2.5 mb-6 w-fit animate-rise">
          <Avatar name={name} src={t.author.avatar_url} size={40} color={palette.accent} className="shadow-sm" />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--ink-1)" }}>{name}</div>
            <div className="font-label" style={{ fontSize: "10px", color: "var(--ink-40)" }}>
              @{t.author.username} · {timeAgo(t.created_at)}
            </div>
          </div>
        </Link>

        {t.media_url && (
          <div className="mb-5 rounded-2xl overflow-hidden animate-rise" style={{ maxHeight: "42vh", boxShadow: "var(--shadow-md)" }}>
            {t.media_type === "video" ? (
              <video src={t.media_url} className="w-full object-cover" style={{ maxHeight: "42vh" }} controls playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.media_url} alt="" className="w-full object-cover" style={{ maxHeight: "42vh" }} />
            )}
          </div>
        )}

        <p
          className="font-display italic animate-rise"
          style={{
            fontSize: t.media_url ? "clamp(1.2rem, 4.6vw, 1.65rem)" : "clamp(1.7rem, 6.4vw, 2.5rem)",
            lineHeight: 1.34,
            fontWeight: 500,
            color: "var(--ink-1)",
            animationDelay: "0.06s",
            textWrap: "balance",
          } as React.CSSProperties}
        >
          <span style={{ color: palette.accent, fontWeight: 600 }}>“</span>
          {t.body}
          <span style={{ color: palette.accent, fontWeight: 600 }}>”</span>
        </p>

        {t.parent_id && (
          <div className="mt-5 w-fit px-3 py-1.5 rounded-full text-xs animate-rise"
            style={{ background: "rgba(28,20,11,0.06)", color: "var(--ink-60)", animationDelay: "0.12s" }}>
            ↳ a branch of another thought
          </div>
        )}
      </div>

      {/* action rail */}
      <div className="absolute right-3.5 flex flex-col items-center gap-5 z-10" style={{ bottom: "calc(var(--nav-h) + 5vh)" }}>
        <button onClick={toggleResonance} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform" aria-label="Resonate">
          <span className="relative grid place-items-center w-12 h-12 rounded-full glass border"
            style={{
              borderColor: resonated ? palette.accent : "var(--line-2)",
              color: resonated ? palette.accent : "var(--ink-60)",
              background: resonated ? "rgba(244,74,38,0.10)" : "var(--glass)",
            }}>
            {burst && (
              <span className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${palette.accent}`, animation: "resonate-burst 0.65s ease-out forwards" }} />
            )}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill={resonated ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3.2 19 12l-7 8.8L5 12z" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>
            {resonated ? "resonating" : "resonate"}
          </span>
        </button>

        <button onClick={branch} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform" aria-label="Branch">
          <span className="grid place-items-center w-12 h-12 rounded-full glass border" style={{ borderColor: "var(--line-2)", color: "var(--ink-60)" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="17" cy="9" r="2.2" />
              <path d="M6 7.2v9.6M6 12h6a5 5 0 0 0 5-5v-.2" />
            </svg>
          </span>
          <span className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>
            branch{t.branch_count > 0 ? ` · ${t.branch_count}` : ""}
          </span>
        </button>

        <button onClick={share} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform" aria-label="Share">
          <span className="grid place-items-center w-12 h-12 rounded-full glass border" style={{ borderColor: "var(--line-2)", color: "var(--ink-60)" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
          <span className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>{shared ? "copied" : "share"}</span>
        </button>
      </div>
    </section>
  );
}

export default function Flux() {
  const router = useRouter();
  const [thoughts, setThoughts] = useState<ThoughtWithMeta[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: rows } = await supabase
      .from("thoughts")
      .select("*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
      .is("circle_id", null)
      .order("created_at", { ascending: false })
      .limit(40);

    if (!rows) { setLoading(false); return; }

    let resonatedSet = new Set<string>();
    if (user) {
      const { data: res } = await supabase
        .from("resonances").select("thought_id").eq("user_id", user.id)
        .in("thought_id", rows.map((r) => r.id));
      resonatedSet = new Set((res ?? []).map((r: { thought_id: string }) => r.thought_id));
    }
    const { data: branches } = await supabase
      .from("thoughts").select("parent_id").in("parent_id", rows.map((r) => r.id));
    const bc: Record<string, number> = {};
    (branches ?? []).forEach((b: { parent_id: string }) => { bc[b.parent_id] = (bc[b.parent_id] ?? 0) + 1; });

    setThoughts(rows.map((r) => ({
      ...r, author: r.author, resonated: resonatedSet.has(r.id), branch_count: bc[r.id] ?? 0,
    })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onPosted = () => load();
    window.addEventListener("thinkr:posted", onPosted);
    return () => window.removeEventListener("thinkr:posted", onPosted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollTop / el.clientHeight));
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-0 grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full skeleton" />
          <span className="label-xs">loading flux…</span>
        </div>
      </div>
    );
  }

  if (thoughts.length === 0) {
    return (
      <div className="fixed inset-0 z-0 grid place-items-center px-8 text-center">
        <div className="animate-rise">
          <div className="font-display italic text-2xl mb-2" style={{ color: "var(--ink-1)" }}>Flux is quiet.</div>
          <p className="text-sm mb-6" style={{ color: "var(--ink-60)" }}>Be the first mind in it.</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent("thinkr:compose"))}
            className="px-5 py-2.5 rounded-full text-white text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
            Post the first thought
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="snap-y snap-mandatory overflow-y-scroll"
        style={{ height: "100dvh" }}
      >
        {thoughts.map((t, i) => (
          <FluxSlide key={t.id} t={t} palette={PALETTES[i % PALETTES.length]} userId={userId} />
        ))}
      </div>

      {/* Ignite live entry */}
      <Link href="/ignite" className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full glass active:scale-95 transition-transform"
        style={{ top: "62px", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--flame)", animation: "pulse-dot 1.4s infinite" }} />
        <span className="font-label" style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--flame)" }}>IGNITE · LIVE</span>
      </Link>

      {/* position rail */}
      <div className="fixed right-2 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 pointer-events-none">
        {thoughts.slice(0, Math.min(thoughts.length, 8)).map((_, i) => (
          <span key={i} className="rounded-full transition-all duration-300"
            style={{
              width: 3, height: i === index ? 16 : 5,
              background: i === index ? "var(--flame)" : "var(--ink-25)",
            }} />
        ))}
      </div>

      {/* scroll cue */}
      {index === 0 && thoughts.length > 1 && (
        <div className="fixed left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-0.5 pointer-events-none"
          style={{ bottom: "calc(var(--nav-h) + 1.5vh)", animation: "scroll-cue 1.8s ease-in-out infinite" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="var(--ink-40)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
          <span className="font-label" style={{ fontSize: "8px", color: "var(--ink-40)", letterSpacing: "0.12em" }}>SWIPE</span>
        </div>
      )}
    </div>
  );
}
