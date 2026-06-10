"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PROMPTS = [
  "What are you thinking?",
  "What's on your mind right now?",
  "A thought you'd defend in a week…",
  "Say the thing you keep not saying.",
  "What did you notice today?",
];

export default function ComposeSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [parent, setParent] = useState<{ id: string; body: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 2000;

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.parentId) {
        setParent({ id: detail.parentId, body: detail.parentBody || "" });
        setPrompt("Where does this thought take you?");
      } else {
        setParent(null);
        setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
      }
      setOpen(true);
    }
    window.addEventListener("thinkr:compose", onOpen);
    return () => window.removeEventListener("thinkr:compose", onOpen);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 250);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (open && (e.metaKey || e.ctrlKey) && e.key === "Enter") post();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, body]);

  async function post() {
    if (!body.trim() || posting) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }
    const { error } = await supabase.from("thoughts").insert({
      author_id: user.id,
      body: body.trim(),
      parent_id: parent?.id ?? null,
    });
    setPosting(false);
    if (!error) {
      setBody("");
      setParent(null);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("thinkr:posted"));
      router.refresh();
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        onClick={() => setOpen(false)}
        className="absolute inset-0"
        style={{ background: "rgba(28,20,11,0.34)", backdropFilter: "blur(3px)" }}
      />
      <div
        className="relative w-full max-w-[560px] mx-auto rounded-t-[28px] px-5 pt-3 pb-6 transition-transform duration-300"
        style={{
          background: "var(--paper)",
          boxShadow: "0 -10px 50px rgba(70,45,12,0.2)",
          transform: open ? "translateY(0)" : "translateY(100%)",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--ink-12)" }} />

        <div className="flex items-center justify-between mb-3">
          <span className="label-xs">{parent ? "Branching a thought" : "New thought"}</span>
          <span className="label-xs" style={{ color: body.length > MAX * 0.9 ? "var(--flame)" : undefined }}>
            {body.length}/{MAX}
          </span>
        </div>

        {parent && (
          <div className="mb-3 pl-3 text-sm italic font-display border-l-2"
            style={{ borderColor: "var(--amber)", color: "var(--ink-60)" }}>
            {parent.body.slice(0, 110)}{parent.body.length > 110 ? "…" : ""}
          </div>
        )}

        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX}
          rows={4}
          placeholder={prompt}
          className="w-full resize-none bg-transparent focus:outline-none placeholder:opacity-35 font-display"
          style={{ fontSize: "1.25rem", lineHeight: 1.5, fontStyle: "italic", color: "var(--ink-1)" }}
        />

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs" style={{ color: "var(--ink-40)" }}>
            No likes. No counts. Just the idea.
          </span>
          <button
            onClick={post}
            disabled={posting || !body.trim()}
            className="px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}
          >
            {posting ? "Posting…" : "Post thought"}
          </button>
        </div>
      </div>
    </div>
  );
}
