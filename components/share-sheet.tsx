"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ShareTarget = { id: string; isGroup: boolean; title: string | null; name: string };
type Payload = { id: string; body: string; username: string };

// Global in-app share sheet. Opened via `thinkr:share` with a thought payload.
// Lists your conversations (connections + groups); tapping one sends the thought
// as a message. Also offers external copy/share.
export default function ShareSheet() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onShare(e: Event) {
      const detail = (e as CustomEvent).detail as Payload;
      setPayload(detail);
      setSentTo(new Set());
      setCopied(false);
      setOpen(true);
      loadTargets();
    }
    window.addEventListener("thinkr:share", onShare);
    return () => window.removeEventListener("thinkr:share", onShare);
  }, []);

  async function loadTargets() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: mems } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
    const ids = (mems ?? []).map((m: { conversation_id: string }) => m.conversation_id);
    if (ids.length === 0) { setTargets([]); setLoading(false); return; }
    const { data: convRows } = await supabase.from("conversations").select("id, is_group, title").in("id", ids);
    const { data: others } = await supabase
      .from("conversation_members")
      .select("conversation_id, user:profiles!conversation_members_user_id_fkey(username, display_name)")
      .in("conversation_id", ids).neq("user_id", user.id);
    const nameByConv: Record<string, string> = {};
    ((others ?? []) as unknown as Array<{ conversation_id: string; user: { username: string; display_name: string | null } }>).forEach((o) => {
      if (!nameByConv[o.conversation_id]) nameByConv[o.conversation_id] = o.user.display_name || o.user.username;
    });
    const list: ShareTarget[] = (convRows ?? []).map((c: { id: string; is_group: boolean; title: string | null }) => ({
      id: c.id, isGroup: c.is_group, title: c.title,
      name: c.is_group ? (c.title || "Circle chat") : (nameByConv[c.id] || "Conversation"),
    }));
    setTargets(list);
    setLoading(false);
  }

  function shareText() {
    return payload ? `“${payload.body}” — @${payload.username} · via Thinkr` : "";
  }

  async function sendTo(t: ShareTarget) {
    if (!payload || busy) return;
    setBusy(t.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("messages").insert({ conversation_id: t.id, sender_id: user.id, body: shareText() });
      setSentTo((prev) => new Set(prev).add(t.id));
    }
    setBusy(null);
  }

  async function external() {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    } catch { /* dismissed */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center" onClick={() => setOpen(false)}>
      <div className="absolute inset-0" style={{ background: "rgba(28,20,11,0.4)", backdropFilter: "blur(3px)" }} />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] mx-auto rounded-t-[28px] px-5 pt-3 pb-7 max-h-[80dvh] flex flex-col"
        style={{ background: "var(--paper)", boxShadow: "0 -10px 50px rgba(70,45,12,0.2)" }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--ink-12)" }} />
        <div className="flex items-center justify-between mb-2">
          <span className="label-xs">Share thought</span>
          <button onClick={() => setOpen(false)} className="text-sm font-semibold" style={{ color: "var(--ink-40)" }}>Close</button>
        </div>

        {payload && (
          <div className="mb-3 rounded-xl px-3.5 py-2.5 font-display italic text-sm" style={{ background: "var(--cream)", border: "1px solid var(--line)", color: "var(--ink-1)" }}>
            “{payload.body.slice(0, 140)}{payload.body.length > 140 ? "…" : ""}”
          </div>
        )}

        <button onClick={external} className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl mb-2 text-sm font-semibold"
          style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-1)" }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
          {copied ? "Copied to clipboard ✓" : "Copy / share outside Thinkr"}
        </button>

        <div className="label-xs mb-1.5 mt-1">Send in Thinkr</div>
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="h-14 rounded-2xl skeleton" />
          ) : targets.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--ink-40)" }}>
              No conversations yet. Connect with a Thought Twin to message them.
            </p>
          ) : (
            <div className="space-y-1.5">
              {targets.map((t) => {
                const sent = sentTo.has(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-2xl" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
                    <div className="w-10 h-10 rounded-full grid place-items-center text-white font-bold shrink-0"
                      style={{ background: t.isGroup ? "linear-gradient(135deg, var(--amber), var(--flame))" : "linear-gradient(135deg, var(--flame), var(--amber))" }}>
                      {t.isGroup ? "◎" : t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--ink-1)" }}>{t.name}</div>
                      {t.isGroup && <div className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>GROUP</div>}
                    </div>
                    <button onClick={() => sendTo(t)} disabled={sent || busy === t.id}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: sent ? "var(--ink-40)" : "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
                      {sent ? "Sent ✓" : busy === t.id ? "…" : "Send"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
