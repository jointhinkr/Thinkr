"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QUIZ, type QuizQuestion } from "@/lib/twin-quiz";
import type { Fingerprint } from "@/lib/types";

// Never-ending "this or that" quiz that keeps fine-tuning the fingerprint.
// Answer as many as you want, skip any, stop whenever. Each answer writes
// q:<key> into the fingerprint (a => 1, b => 0).
export default function TwinQuiz() {
  const [userId, setUserId] = useState<string | null>(null);
  const [current, setCurrent] = useState<QuizQuestion | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [flip, setFlip] = useState(0); // re-trigger entrance animation

  const answeredRef = useRef<Set<string>>(new Set());
  const skippedRef = useRef<Set<string>>(new Set());
  const fpRef = useRef<Fingerprint>({});

  function nextQuestion(): QuizQuestion | null {
    return QUIZ.find((q) => !answeredRef.current.has(q.key) && !skippedRef.current.has(q.key)) ?? null;
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setReady(true); return; }
      setUserId(user.id);
      const [{ data: ans }, { data: prof }] = await Promise.all([
        supabase.from("twin_quiz_answers").select("qkey").eq("user_id", user.id),
        supabase.from("profiles").select("fingerprint").eq("id", user.id).single(),
      ]);
      answeredRef.current = new Set((ans ?? []).map((a: { qkey: string }) => a.qkey));
      setAnsweredCount(answeredRef.current.size);
      fpRef.current = (prof?.fingerprint as Fingerprint) ?? {};
      setCurrent(nextQuestion());
      setReady(true);
    })();
  }, []);

  async function choose(q: QuizQuestion, choice: "a" | "b") {
    if (busy || !userId) return;
    setBusy(true);
    const supabase = createClient();
    const fp: Fingerprint = { ...fpRef.current, [`q:${q.key}`]: choice === "a" ? 1 : 0 };
    fpRef.current = fp;
    await Promise.all([
      supabase.from("twin_quiz_answers").upsert({ user_id: userId, qkey: q.key, choice }),
      supabase.from("profiles").update({ fingerprint: fp }).eq("id", userId),
    ]);
    answeredRef.current.add(q.key);
    setAnsweredCount(answeredRef.current.size);
    setCurrent(nextQuestion());
    setFlip((f) => f + 1);
    setBusy(false);
  }

  function skip(q: QuizQuestion) {
    skippedRef.current.add(q.key);
    setCurrent(nextQuestion());
    setFlip((f) => f + 1);
  }

  if (!ready) return <div className="h-44 rounded-2xl skeleton" />;

  return (
    <div className="rounded-2xl px-5 py-5" style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="label-xs">Keep tuning your twin</span>
        {answeredCount > 0 && <span className="font-label" style={{ fontSize: "10px", color: "var(--ink-40)" }}>{answeredCount} answered</span>}
      </div>

      {!current ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-1">🎉</div>
          <p className="text-sm" style={{ color: "var(--ink-1)", fontWeight: 600 }}>You&apos;ve explored every question.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-60)" }}>We&apos;ll keep adding more — your answers keep sharpening who we match you with.</p>
        </div>
      ) : (
        <div key={flip} className="animate-rise">
          <p className="text-xs mt-1 mb-3" style={{ color: "var(--ink-60)" }}>
            Tap the one that&apos;s more you. Answer as many as you like — skip or stop anytime.
          </p>
          <div className="font-label text-center mb-3" style={{ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--flame)" }}>
            {current.tag || "This or that"}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["a", "b"] as const).map((opt) => {
              const o = current[opt];
              return (
                <button key={opt} onClick={() => choose(current, opt)} disabled={busy}
                  className="rounded-2xl px-3 py-5 text-center transition-transform active:scale-[0.97] disabled:opacity-60"
                  style={{ background: "#fff", border: "1.5px solid var(--line)" }}>
                  <div className="text-3xl mb-1.5">{o.emoji}</div>
                  <div className="text-[15px] font-semibold" style={{ color: "var(--ink-1)" }}>{o.label}</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => skip(current)} disabled={busy} className="mt-3 w-full text-center text-xs font-medium" style={{ color: "var(--ink-40)" }}>
            Skip this one →
          </button>
        </div>
      )}
    </div>
  );
}
