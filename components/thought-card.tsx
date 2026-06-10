"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ThoughtWithMeta } from "@/lib/types";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ThoughtCard({
  thought,
  onBranch,
}: {
  thought: ThoughtWithMeta;
  onBranch?: (parent: ThoughtWithMeta) => void;
}) {
  const [resonated, setResonated] = useState(thought.resonated);
  const [toggling, setToggling] = useState(false);

  async function toggleResonance() {
    if (toggling) return;
    setToggling(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setToggling(false); return; }

    if (resonated) {
      await supabase
        .from("resonances")
        .delete()
        .eq("user_id", user.id)
        .eq("thought_id", thought.id);
    } else {
      await supabase.from("resonances").insert({
        user_id: user.id,
        thought_id: thought.id,
      });
    }
    setResonated((r) => !r);
    setToggling(false);
  }

  return (
    <article className="rounded-2xl bg-white border border-black/6 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/profile/${thought.author.username}`}
          className="flex items-center gap-2 group"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "var(--flame)" }}
          >
            {(thought.author.display_name || thought.author.username)
              .charAt(0)
              .toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium group-hover:underline">
              {thought.author.display_name || thought.author.username}
            </div>
            <div className="text-xs opacity-40" style={{ fontFamily: "'Space Mono', monospace" }}>
              @{thought.author.username}
            </div>
          </div>
        </Link>
        <span className="text-xs opacity-30" style={{ fontFamily: "'Space Mono', monospace" }}>
          {timeAgo(thought.created_at)}
        </span>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap">{thought.body}</p>

      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={toggleResonance}
          disabled={toggling}
          className="flex items-center gap-1.5 text-xs transition-opacity disabled:opacity-40"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: resonated ? "var(--flame)" : "inherit",
            opacity: resonated ? 1 : 0.4,
          }}
          title="Resonate — private, never public"
        >
          <span className="text-base">{resonated ? "◆" : "◇"}</span>
          <span>{resonated ? "resonating" : "resonate"}</span>
        </button>

        {onBranch && (
          <button
            onClick={() => onBranch(thought)}
            className="flex items-center gap-1.5 text-xs opacity-40 hover:opacity-70 transition-opacity"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            <span>↳</span>
            <span>
              branch
              {thought.branch_count > 0 ? ` (${thought.branch_count})` : ""}
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
