"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import RichText from "@/components/rich-text";
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
  canManage,
  onChanged,
}: {
  thought: ThoughtWithMeta;
  onBranch?: (parent: ThoughtWithMeta) => void;
  canManage?: boolean;
  onChanged?: () => void;
}) {
  const [resonated, setResonated] = useState(thought.resonated);
  const [toggling, setToggling] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function editThought() {
    setMenu(false);
    window.dispatchEvent(new CustomEvent("thinkr:compose", {
      detail: { editId: thought.id, editBody: thought.body, editMediaUrl: thought.media_url, editMediaType: thought.media_type },
    }));
  }
  async function deleteThought() {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("thoughts").delete().eq("id", thought.id);
    setDeleting(false);
    setMenu(false);
    onChanged?.();
  }

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
          <Avatar name={thought.author.display_name || thought.author.username} src={thought.author.avatar_url} size={32} />
          <div>
            <div className="text-sm font-medium group-hover:underline">
              {thought.author.display_name || thought.author.username}
            </div>
            <div className="text-xs opacity-40" style={{ fontFamily: "'Space Mono', monospace" }}>
              @{thought.author.username}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="text-xs opacity-30" style={{ fontFamily: "'Space Mono', monospace" }}>
            {timeAgo(thought.created_at)}
          </span>
          {canManage && (
            <div className="relative">
              <button onClick={() => { setMenu((m) => !m); setConfirmDel(false); }} aria-label="Post options"
                className="w-7 h-7 rounded-full grid place-items-center opacity-40 hover:opacity-80">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
              </button>
              {menu && (
                <div className="absolute right-0 mt-1 w-40 rounded-xl overflow-hidden py-1 z-20"
                  style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
                  <button onClick={editThought} className="w-full text-left px-4 py-2.5 text-sm" style={{ color: "var(--ink-1)" }}>Edit</button>
                  {!confirmDel ? (
                    <button onClick={() => setConfirmDel(true)} className="w-full text-left px-4 py-2.5 text-sm" style={{ color: "#dc2626" }}>Delete</button>
                  ) : (
                    <button onClick={deleteThought} disabled={deleting} className="w-full text-left px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ color: "#dc2626", background: "#fee2e2" }}>
                      {deleting ? "Deleting…" : "Confirm delete"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap"><RichText text={thought.body} /></p>

      {thought.media_url && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          {thought.media_type === "video" ? (
            <video src={thought.media_url} className="w-full max-h-96" controls playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thought.media_url} alt="" className="w-full max-h-96 object-cover" />
          )}
        </div>
      )}

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
            <span>branch</span>
          </button>
        )}

        <Link
          href={`/thought/${thought.id}`}
          className="flex items-center gap-1.5 text-xs transition-opacity"
          style={{ fontFamily: "'Space Mono', monospace", color: thought.branch_count > 0 ? "var(--flame)" : "inherit", opacity: thought.branch_count > 0 ? 1 : 0.4 }}
        >
          <span>↳</span>
          <span>{thought.branch_count > 0 ? `${thought.branch_count} branch${thought.branch_count > 1 ? "es" : ""}` : "view thread"}</span>
        </Link>
      </div>
    </article>
  );
}
