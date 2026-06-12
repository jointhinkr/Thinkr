"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SparkPrompt, SparkResponse, Profile } from "@/lib/types";

type ResponseWithAuthor = SparkResponse & { author: Pick<Profile, "username" | "display_name"> };

export default function SparkPage() {
  const [prompt, setPrompt] = useState<SparkPrompt | null>(null);
  const [responses, setResponses] = useState<ResponseWithAuthor[]>([]);
  const [myResponse, setMyResponse] = useState<SparkResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("spark_streak, spark_last_answered").eq("id", user.id).single();
        const last = prof?.spark_last_answered ?? null;
        const alive = last === today || last === yesterday;
        setStreak(alive ? (prof?.spark_streak ?? 0) : 0);
      }
      const { data: p } = await supabase
        .from("spark_prompts")
        .select()
        .eq("active_date", today)
        .single();

      if (!p) { setLoading(false); return; }
      setPrompt(p);

      const { data: resps } = await supabase
        .from("spark_responses")
        .select("*, author:profiles!spark_responses_author_id_fkey(username, display_name)")
        .eq("prompt_id", p.id)
        .order("created_at", { ascending: false });

      setResponses((resps as ResponseWithAuthor[]) ?? []);

      if (user) {
        const mine = (resps ?? []).find((r: SparkResponse) => r.author_id === user.id);
        setMyResponse(mine ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function submit() {
    if (!draft.trim() || !prompt) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }

    const { data, error } = await supabase
      .from("spark_responses")
      .insert({ prompt_id: prompt.id, author_id: user.id, body: draft.trim() })
      .select("*, author:profiles!spark_responses_author_id_fkey(username, display_name)")
      .single();

    if (!error && data) {
      setMyResponse(data);
      setResponses((r) => [data as ResponseWithAuthor, ...r]);
      setDraft("");
      const { data: s } = await supabase.rpc("record_spark_answer");
      if (typeof s === "number") setStreak(s);
    }
    setPosting(false);
  }

  if (loading) {
    return <div className="text-center py-20 opacity-30 text-sm">Loading spark…</div>;
  }

  if (!prompt) {
    return (
      <div className="text-center py-20 opacity-40">
        <p className="text-sm">No spark today. Come back tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs tracking-widest opacity-40"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            THE DAILY SPARK · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
          {streak > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(244,74,38,0.1)", color: "var(--flame)" }}>
              🔥 {streak} day{streak !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <h1
          className="text-2xl mt-2 leading-snug"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {prompt.prompt}
        </h1>
      </div>

      {!myResponse ? (
        <div className="rounded-2xl bg-white border border-black/6 px-5 py-4 space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            placeholder="Your answer…"
            className="w-full resize-none text-sm leading-relaxed bg-transparent focus:outline-none placeholder:opacity-30"
            rows={4}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-30" style={{ fontFamily: "'Space Mono', monospace" }}>
              {draft.length}/1000
            </span>
            <button
              onClick={submit}
              disabled={posting || !draft.trim()}
              className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40"
              style={{ background: "var(--flame)" }}
            >
              {posting ? "sharing…" : "share response"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl px-5 py-4 border-l-4"
          style={{ background: "#fff8f5", borderColor: "var(--flame)" }}
        >
          <span
            className="text-xs opacity-40 mb-2 block"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            YOUR RESPONSE
          </span>
          <p className="text-sm leading-relaxed">{myResponse.body}</p>
        </div>
      )}

      {myResponse && responses.length > 0 && (
        <div className="space-y-3">
          <div
            className="text-xs tracking-widest opacity-40"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {responses.length} THINKER{responses.length !== 1 ? "S" : ""} ANSWERED
          </div>
          {responses
            .filter((r) => r.author_id !== userId)
            .map((r) => (
              <div
                key={r.id}
                className="rounded-2xl bg-white border border-black/6 px-5 py-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: "var(--amber)" }}
                  >
                    {(r.author.display_name || r.author.username).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium">
                    {r.author.display_name || r.author.username}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{r.body}</p>
              </div>
            ))}
        </div>
      )}

      {!myResponse && (
        <p className="text-xs text-center opacity-30">
          Answer to see how other thinkers responded today.
        </p>
      )}
    </div>
  );
}
