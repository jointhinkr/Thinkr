"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function DailyQuestionForm({ current }: { current: string }) {
  const [q, setQ] = useState(current);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!q.trim() || saving) return;
    setSaving(true); setOk(false); setError("");
    const supabase = createClient();
    // Admin-gated in the DB — a non-admin calling this is rejected server-side.
    const { error } = await supabase.rpc("set_daily_question", { q: q.trim() });
    setSaving(false);
    if (error) setError(error.message);
    else setOk(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="label-xs">Admin</span>
        <h1 className="font-display text-3xl mt-0.5" style={{ color: "var(--ink-1)" }}>Daily question</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>
          Sets today&apos;s Daily Spark — the question every thinker sees.
        </p>
      </div>

      <div className="rounded-2xl px-5 py-5 space-y-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
        <label className="block font-semibold text-sm" style={{ color: "var(--ink-1)" }}>Today&apos;s question</label>
        <textarea
          value={q}
          onChange={(e) => { setQ(e.target.value); setOk(false); setError(""); }}
          rows={3}
          maxLength={280}
          placeholder="What's something you changed your mind about this year?"
          className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
          style={{ background: "#fff", border: "1.5px solid var(--line)", color: "var(--ink-1)" }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: error ? "#dc2626" : "var(--flame)" }}>
            {error ? error : ok ? "Saved — live for everyone now." : `${q.length}/280`}
          </span>
          <button
            onClick={save}
            disabled={saving || !q.trim()}
            className="px-5 py-2.5 rounded-full text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}
          >
            {saving ? "Saving…" : "Save question"}
          </button>
        </div>
      </div>

      <Link href="/spark" className="inline-block text-xs font-medium" style={{ color: "var(--flame)" }}>
        View the public Daily Spark →
      </Link>
    </div>
  );
}
