"use client";

import { useEffect, useRef, useState } from "react";

type Slide = {
  kind: "hero" | "quote" | "feature" | "cta";
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  accent: string;
  from: string;
  via: string;
};

const SLIDES: Slide[] = [
  {
    kind: "hero",
    eyebrow: "Welcome to Thinkr",
    title: (<>Find the people who <em>actually</em> get you.</>),
    body: "Built for connection, not for your attention. No likes. No performing. Just your people.",
    accent: "#F44A26", from: "#FFE3C2", via: "#FBD9B0",
  },
  {
    kind: "quote",
    eyebrow: "Why we exist",
    title: (<>“The mortality impact of being socially disconnected is similar to that caused by smoking up to 15&nbsp;cigarettes a day — and even greater than that associated with obesity and physical inactivity.”</>),
    body: "Loneliness is an epidemic. Social media — built to capture attention, not foster understanding — has only deepened it. Thinkr is the corrective.",
    accent: "#C9381A", from: "#FFD9CE", via: "#F8BFA8",
  },
  {
    kind: "feature",
    eyebrow: "Thought Twin",
    title: (<>We pair you with the person who thinks most like you.</>),
    body: "A short survey maps your “thinking fingerprint.” Our matching finds your closest mind — then you both choose to connect. No vanity metrics. Ever.",
    accent: "#C9821E", from: "#FFE9CC", via: "#F7C77E",
  },
  {
    kind: "feature",
    eyebrow: "Ideas first",
    title: (<>A feed of thoughts. One Spark a day. Circles for what you love.</>),
    body: "Read minds in the Flux reel, answer the Daily Spark with everyone, branch ideas, and gather in topic Circles. Substance over scrolling.",
    accent: "#B6791B", from: "#FBEFD8", via: "#F3D9A4",
  },
  {
    kind: "cta",
    eyebrow: "It's time",
    title: (<>You've been scrolling long enough.</>),
    body: "It's time to find your people.",
    accent: "#F44A26", from: "#FFDCC0", via: "#FFC58C",
  },
];

export default function IntroCarousel({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const last = SLIDES.length - 1;

  const next = () => setI((p) => (p < last ? p + 1 : p));
  const prev = () => setI((p) => (p > 0 ? p - 1 : p));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden" style={{ background: "var(--cream)" }}>
      {/* track */}
      <div
        className="flex h-full transition-transform duration-500"
        style={{ transform: `translateX(-${i * 100}%)`, transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          if (dx < -45) next(); else if (dx > 45) prev();
          startX.current = null;
        }}
      >
        {SLIDES.map((s, idx) => (
          <section key={idx} className="relative shrink-0 w-full h-full overflow-hidden"
            onClick={(e) => { const w = (e.currentTarget as HTMLElement).clientWidth; (e.nativeEvent.offsetX > w * 0.35) ? next() : prev(); }}>
            <div className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 28% 16%, ${s.from} 0%, ${s.via} 44%, var(--cream) 100%)` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(55% 40% at 80% 84%, ${s.accent}22 0%, transparent 70%)`, animation: "aurora-drift 16s ease-in-out infinite" }} />

            <div className="relative h-full flex flex-col justify-center max-w-[560px] mx-auto px-7" style={{ paddingBottom: "16vh" }}>
              {idx === i && (
                <>
                  <div className="font-label animate-rise" style={{ fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: s.accent, marginBottom: 18 }}>
                    {s.eyebrow}
                  </div>
                  <h2 className="font-display animate-rise" style={{
                    fontStyle: s.kind === "quote" ? "italic" : "normal",
                    fontWeight: s.kind === "quote" ? 400 : 600,
                    fontSize: s.kind === "quote" ? "clamp(1.4rem,5vw,1.9rem)" : "clamp(1.9rem,7vw,2.7rem)",
                    lineHeight: s.kind === "quote" ? 1.4 : 1.12, color: "var(--ink-1)", animationDelay: "0.05s",
                    textWrap: "balance",
                  } as React.CSSProperties}>
                    {s.title}
                  </h2>
                  {s.kind === "quote" && (
                    <div className="animate-rise mt-3 text-sm" style={{ color: "var(--ink-60)", animationDelay: "0.1s" }}>
                      — Dr. Vivek H. Murthy, U.S. Surgeon General.{" "}
                      <span style={{ fontStyle: "italic" }}>Our Epidemic of Loneliness and Isolation</span>, 2023 Surgeon General&apos;s Advisory.
                    </div>
                  )}
                  {s.body && (
                    <p className="animate-rise mt-5 text-[16.5px]" style={{ color: s.kind === "cta" ? "var(--ink-1)" : "var(--ink-60)", lineHeight: 1.55, animationDelay: "0.14s", fontSize: s.kind === "cta" ? "1.4rem" : undefined, fontFamily: s.kind === "cta" ? "var(--serif)" : undefined, fontStyle: s.kind === "cta" ? "italic" : undefined }}>
                      {s.body}
                    </p>
                  )}
                  {s.kind === "cta" && (
                    <button onClick={(e) => { e.stopPropagation(); onDone(); }}
                      className="animate-rise mt-8 w-full px-6 py-4 rounded-full text-white text-base font-semibold transition-transform active:scale-[0.98]"
                      style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)", animationDelay: "0.2s" }}>
                      Enter Thinkr →
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* top bar: brand + skip */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 h-14 z-10">
        <span className="font-display italic text-[20px]" style={{ color: "var(--flame)", fontWeight: 600 }}>Thinkr</span>
        <button onClick={onDone} className="font-label" style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--ink-40)" }}>SKIP →</button>
      </div>

      {/* dots */}
      <div className="absolute left-0 right-0 flex items-center justify-center gap-2 z-10" style={{ bottom: "7vh" }}>
        {SLIDES.map((_, idx) => (
          <button key={idx} onClick={(e) => { e.stopPropagation(); setI(idx); }} aria-label={`Slide ${idx + 1}`}
            className="rounded-full transition-all duration-300"
            style={{ height: 6, width: idx === i ? 22 : 6, background: idx === i ? "var(--flame)" : "var(--ink-25)" }} />
        ))}
      </div>

      {/* hint */}
      {i < last && (
        <div className="absolute right-6 z-10 font-label" style={{ bottom: "calc(7vh + 2px)", fontSize: "10px", color: "var(--ink-40)", letterSpacing: "0.08em" }}>
          tap or swipe →
        </div>
      )}
    </div>
  );
}
