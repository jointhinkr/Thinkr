"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadToBucket, mediaTypeOf } from "@/lib/upload";

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
  const [editId, setEditId] = useState<string | null>(null);
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX = 2000;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const type = mediaTypeOf(file);
    if (!type) return;
    setUploading(true);
    const url = await uploadToBucket("media", file);
    setUploading(false);
    if (url) setMedia({ url, type });
  }

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.editId) {
        // Editing an existing thought.
        setEditId(detail.editId);
        setParent(null);
        setBody(detail.editBody || "");
        setMedia(detail.editMediaUrl ? { url: detail.editMediaUrl, type: detail.editMediaType || "image" } : null);
        setPrompt("Edit your thought");
      } else if (detail?.parentId) {
        setEditId(null);
        setParent({ id: detail.parentId, body: detail.parentBody || "" });
        setBody("");
        setPrompt("Where does this thought take you?");
        setMedia(null);
      } else {
        setEditId(null);
        setParent(null);
        setBody("");
        setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
        setMedia(null);
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
    let error;
    if (editId) {
      ({ error } = await supabase.from("thoughts").update({
        body: body.trim(),
        media_url: media?.url ?? null,
        media_type: media?.type ?? null,
      }).eq("id", editId).eq("author_id", user.id));
    } else {
      ({ error } = await supabase.from("thoughts").insert({
        author_id: user.id,
        body: body.trim(),
        parent_id: parent?.id ?? null,
        media_url: media?.url ?? null,
        media_type: media?.type ?? null,
      }));
    }
    setPosting(false);
    if (!error) {
      setBody("");
      setParent(null);
      setEditId(null);
      setMedia(null);
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
          <span className="label-xs">{editId ? "Edit thought" : parent ? "Branching a thought" : "New thought"}</span>
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

        {media && (
          <div className="relative mt-3 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            {media.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="attachment" className="w-full max-h-72 object-cover" />
            ) : (
              <video src={media.url} className="w-full max-h-72" controls />
            )}
            <button onClick={() => setMedia(null)} aria-label="Remove media"
              className="absolute top-2 right-2 w-7 h-7 rounded-full grid place-items-center text-white text-sm"
              style={{ background: "rgba(28,20,11,0.55)" }}>✕</button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />

        <div className="flex items-center justify-between mt-4">
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full disabled:opacity-50 active:scale-95 transition-transform"
            style={{ border: "1px solid var(--line-2)", color: "var(--ink-60)" }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4 4 3 3-2 4 3" />
            </svg>
            {uploading ? "uploading…" : media ? "change" : "photo / video"}
          </button>
          <button
            onClick={post}
            disabled={posting || !body.trim()}
            className="px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}
          >
            {posting ? (editId ? "Saving…" : "Posting…") : editId ? "Save changes" : "Post thought"}
          </button>
        </div>
      </div>
    </div>
  );
}
