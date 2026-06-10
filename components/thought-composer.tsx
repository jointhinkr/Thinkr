"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ThoughtWithMeta } from "@/lib/types";

export default function ThoughtComposer({
  circleId,
  parentThought,
  onPosted,
  onCancel,
}: {
  circleId?: string;
  parentThought?: ThoughtWithMeta;
  onPosted: () => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const MAX = 2000;

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }

    const { error } = await supabase.from("thoughts").insert({
      author_id: user.id,
      body: body.trim(),
      parent_id: parentThought?.id ?? null,
      circle_id: circleId ?? null,
    });

    if (error) {
      setError(error.message);
    } else {
      setBody("");
      onPosted();
    }
    setPosting(false);
  }

  return (
    <div className="rounded-2xl bg-white border border-black/6 px-5 py-4 space-y-3">
      {parentThought && (
        <div className="text-xs opacity-40 border-l-2 pl-3 italic" style={{ borderColor: "var(--amber)" }}>
          branching from: {parentThought.body.slice(0, 80)}
          {parentThought.body.length > 80 ? "…" : ""}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX}
        placeholder={
          parentThought
            ? "Where does this thought take you?"
            : "What are you thinking?"
        }
        className="w-full resize-none text-sm leading-relaxed bg-transparent focus:outline-none placeholder:opacity-30"
        rows={3}
      />

      <div className="flex items-center justify-between">
        <span
          className="text-xs opacity-30"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {body.length}/{MAX}
        </span>

        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm opacity-50 hover:opacity-70 transition-opacity"
            >
              cancel
            </button>
          )}
          <button
            onClick={post}
            disabled={posting || !body.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--flame)" }}
          >
            {posting ? "posting…" : "post thought"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
