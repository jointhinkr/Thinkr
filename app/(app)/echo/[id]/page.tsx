"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { detectContactInfo, contactWarning, SAFETY_RULE } from "@/lib/safety";
import type { Profile } from "@/lib/types";

type Msg = { id: string; sender_id: string; body: string; created_at: string };

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<Pick<Profile, "id" | "username" | "display_name"> | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [safetyWarn, setSafetyWarn] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // realtime channel — created synchronously with a unique name so React
    // Strict Mode's double-mount can't add listeners to an already-subscribed channel
    const channel = supabase
      .channel(`conv:${id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        })
      .subscribe();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (!active) return;
      setUserId(user.id);

      const { data: conv } = await supabase.from("conversations").select("is_group, title").eq("id", id).single();
      if (active) { setIsGroup(!!conv?.is_group); setTitle(conv?.title ?? null); }

      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id, user:profiles!conversation_members_user_id_fkey(id, username, display_name)")
        .eq("conversation_id", id);

      if (!members || members.length === 0) { router.push("/echo"); return; }
      const nm: Record<string, string> = {};
      (members as Array<{ user_id: string; user: unknown }>).forEach((m) => {
        const u = m.user as { username: string; display_name: string | null };
        nm[m.user_id] = u.display_name || u.username;
      });
      if (active) setNames(nm);
      const o = members.find((m: { user_id: string }) => m.user_id !== user.id) as { user: unknown } | undefined;
      setOther((o?.user as Pick<Profile, "id" | "username" | "display_name">) ?? null);

      const { data: msgs } = await supabase
        .from("messages").select("id, sender_id, body, created_at")
        .eq("conversation_id", id).order("created_at", { ascending: true });
      if (!active) return;
      setMessages((msgs as Msg[]) ?? []);
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 60);

      await supabase.from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", id).eq("user_id", user.id);
    })();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [id, router, scrollToBottom]);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  async function send() {
    if (!body.trim() || sending) return;
    const check = detectContactInfo(body);
    if (check.blocked) { setSafetyWarn(contactWarning(check.kind)); return; }
    setSafetyWarn("");
    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, body: body.trim() })
      .select("id, sender_id, body, created_at").single();
    if (data) setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
    setBody("");
    setSending(false);
  }

  const name = isGroup ? (title || "Circle chat") : (other ? (other.display_name || other.username) : "");

  return (
    <div className="-mt-2">
      {/* thread header */}
      <div className="sticky z-30 -mx-4 px-4 py-2.5 flex items-center gap-3 glass"
        style={{ top: "52px", borderBottom: "1px solid var(--line)" }}>
        <Link href="/echo" aria-label="Back" className="w-8 h-8 grid place-items-center rounded-full -ml-1" style={{ color: "var(--ink-60)" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
        {isGroup ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full grid place-items-center text-white font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--amber), var(--flame))" }}>◎</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--ink-1)" }}>{name}</div>
              <div className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>group · {Object.keys(names).length} members</div>
            </div>
          </div>
        ) : other ? (
          <Link href={`/profile/${other.username}`} className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full grid place-items-center text-white font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--flame), var(--amber))" }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--ink-1)" }}>{name}</div>
              <div className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>bonded · @{other.username}</div>
            </div>
          </Link>
        ) : null}
      </div>

      {/* messages */}
      <div className="py-4 space-y-2" style={{ paddingBottom: "96px" }}>
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]" style={{ background: "#FFF6EC", border: "1px solid var(--amber)", color: "var(--ink-60)", lineHeight: 1.4 }}>
          <span>🛡️</span><span>{SAFETY_RULE}</span>
        </div>
        {loading && <div className="h-10 w-2/3 rounded-2xl skeleton" />}
        {!loading && messages.length === 0 && (
          <div className="text-center py-10">
            <p className="font-display italic text-lg" style={{ color: "var(--ink-60)" }}>
              A new bond. Say something true.
            </p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {isGroup && !mine && (
                <span className="font-label mb-0.5 ml-1" style={{ fontSize: "9px", color: "var(--ink-40)" }}>{names[m.sender_id] || "someone"}</span>
              )}
              <div className="max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed animate-fade"
                style={mine
                  ? { background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", color: "#fff", borderRadius: "18px 18px 5px 18px", boxShadow: "var(--shadow-sm)" }
                  : { background: "var(--paper)", color: "var(--ink-1)", border: "1px solid var(--line)", borderRadius: "18px 18px 18px 5px" }}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="fixed inset-x-0 z-40 flex flex-col items-center px-4" style={{ bottom: "calc(var(--nav-h) + 6px)" }}>
        {safetyWarn && (
          <div className="w-full max-w-[560px] mb-2 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", lineHeight: 1.45 }}>
            {safetyWarn}
          </div>
        )}
        <div className="w-full max-w-[560px] flex items-end gap-2 p-1.5 rounded-[24px] glass"
          style={{ border: "1px solid var(--line-2)", boxShadow: "var(--shadow-lg)" }}>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); if (safetyWarn) setSafetyWarn(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={4000}
            placeholder="Message…"
            className="flex-1 resize-none bg-transparent focus:outline-none text-sm px-3 py-2 max-h-28"
            style={{ color: "var(--ink-1)" }}
          />
          <button onClick={send} disabled={sending || !body.trim()} aria-label="Send"
            className="w-10 h-10 rounded-full grid place-items-center text-white shrink-0 transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
