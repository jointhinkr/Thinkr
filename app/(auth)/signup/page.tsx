"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    display_name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase().replace(/\s+/g, "_"),
          display_name: form.display_name || form.username,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Email confirmation disabled — straight into onboarding.
      router.push("/onboarding");
      router.refresh();
    } else {
      // Email confirmation required — prompt the user to confirm.
      setConfirmSent(true);
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--cream)" }}>
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-3" style={{ fontFamily: "'Fraunces', serif", color: "var(--flame)" }}>Thinkr</div>
          <div className="text-2xl mb-2" style={{ fontFamily: "'Fraunces', serif" }}>Check your email ✦</div>
          <p className="text-sm opacity-60">
            We sent a confirmation link to <b>{form.email}</b>. Click it to activate your account, then come back and sign in.
          </p>
          <div className="mt-4 mx-auto max-w-xs rounded-xl px-4 py-3 text-sm" style={{ background: "#FFF6EC", border: "1px solid var(--amber)", color: "var(--ink-60)" }}>
            📩 Don&apos;t see it? <b>Check your spam / junk folder</b> — and mark it &quot;Not spam&quot; so future emails land in your inbox.
          </div>
          <Link href="/login" className="inline-block mt-6 px-5 py-2.5 rounded-full text-white text-sm font-semibold" style={{ background: "var(--flame)" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
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
            join the conversation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
              DISPLAY NAME
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={set("display_name")}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="How you'll appear"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
              USERNAME
            </label>
            <input
              type="text"
              value={form.username}
              onChange={set("username")}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="letters, numbers, underscores"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
              EMAIL
            </label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ fontFamily: "'Space Mono', monospace" }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="min 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <p className="text-xs leading-relaxed" style={{ color: "var(--ink-40)" }}>
            By creating an account, you confirm you are 18 or older — or an authorized Thinkr beta tester — and you agree
            to our{" "}
            <Link href="/terms" className="underline" style={{ color: "var(--flame)" }}>Terms</Link>,{" "}
            <Link href="/privacy" className="underline" style={{ color: "var(--flame)" }}>Privacy Policy</Link>, and{" "}
            <Link href="/cookies" className="underline" style={{ color: "var(--flame)" }}>Cookie Policy</Link>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-medium text-sm transition-opacity disabled:opacity-60"
            style={{ background: "var(--flame)" }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm mt-6 opacity-60">
          Already a thinker?{" "}
          <Link href="/login" className="underline opacity-100" style={{ color: "var(--flame)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
