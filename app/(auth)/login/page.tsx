"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import IntroCarousel from "@/components/intro-carousel";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("thinkr_intro_seen")) {
      setShowIntro(true);
    }
  }, []);

  function dismissIntro() {
    setShowIntro(false);
    try { localStorage.setItem("thinkr_intro_seen", "1"); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // New users (no thinking fingerprint yet) start with the questionnaire.
      let dest = "/flux";
      const uid = signInData.user?.id;
      if (uid) {
        const { data: prof } = await supabase.from("profiles").select("fingerprint").eq("id", uid).single();
        const fp = (prof?.fingerprint ?? {}) as Record<string, unknown>;
        if (Object.keys(fp).length === 0) dest = "/onboarding";
      }
      router.push(dest);
      router.refresh();
    }
  }

  return (
    <>
    {showIntro && <IntroCarousel onDone={dismissIntro} />}
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--cream)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div
            className="text-4xl mb-2"
            style={{ fontFamily: "'Fraunces', serif", color: "var(--flame)" }}
          >
            Thinkr
          </div>
          <p className="text-sm opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
            find your thought twin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "var(--flame)" } as React.CSSProperties}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-medium text-sm transition-opacity disabled:opacity-60"
            style={{ background: "var(--flame)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm mt-6 opacity-60">
          No account?{" "}
          <Link href="/signup" className="underline opacity-100" style={{ color: "var(--flame)" }}>
            Join Thinkr
          </Link>
        </p>

        <button
          onClick={() => setShowIntro(true)}
          className="mt-4 w-full text-center text-xs"
          style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", color: "var(--flame)" }}
        >
          ✦ NEW HERE? SEE WHAT THINKR IS →
        </button>
      </div>
    </div>
    </>
  );
}
