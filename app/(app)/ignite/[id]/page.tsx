"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { detectContactInfo, contactWarning, SAFETY_RULE } from "@/lib/safety";
import LivestreamStage from "@/components/livestream-stage";

const KIND_COLOR: Record<string, string> = { debate: "#F44A26", study: "#C9821E", chill: "#B6791B", open: "#E5604B" };

type RMsg = { id: string; sender_id: string; body: string; created_at: string };

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<{ title: string; topic: string | null; kind: string; host_id: string; is_stream: boolean } | null>(null);
  const [messages, setMessages] = useState<RMsg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [safetyWarn, setSafetyWarn] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const channel = supabase
      .channel(`room:${id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as RMsg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          setNames((prev) => {
            if (prev[m.sender_id]) return prev;
            supabase.from("profiles").select("display_name, username").eq("id", m.sender_id).single()
              .then(({ data }) => { if (data) setNames((n) => ({ ...n, [m.sender_id]: data.display_name || data.username })); });
            return prev;
          });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${id}` },
        async () => { const { count: c } = await supabase.from("room_participants").select("*", { count: "exact", head: true }).eq("room_id", id); setCount(c ?? 0); })
      .subscribe();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: r } = await supabase.from("live_rooms").select("title, topic, kind, host_id, is_stream").eq("id", id).single();
      if (!r) { router.push("/ignite"); return; }
      if (active) setRoom(r);

      // join
      await supabase.from("room_participants").upsert({ room_id: id, user_id: user.id }, { onConflict: "room_id,user_id" });

      const { data: parts } = await supabase
        .from("room_participants")
        .select("user_id, user:profiles!room_participants_user_id_fkey(display_name, username)")
        .eq("room_id", id);
      const nm: Record<string, string> = {};
      (parts ?? []).forEach((p: { user_id: string; user: unknown }) => {
        const u = p.user as { display_name: string | null; username: string };
        nm[p.user_id] = u.display_name || u.username;
      });
      if (active) { setNames(nm); setCount(parts?.length ?? 0); }

      const { data: msgs } = await supabase.from("room_messages").select("id, sender_id, body, created_at").eq("room_id", id).order("created_at", { ascending: true });
      if (active) { setMessages((msgs as RMsg[]) ?? []); setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView(), 60); }
    })();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [id, router]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send() {
    if (!body.trim()) return;
    const check = detectContactInfo(body);
    if (check.blocked) { setSafetyWarn(contactWarning(check.kind)); return; }
    setSafetyWarn("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("room_messages").insert({ room_id: id, sender_id: user.id, body: body.trim() }).select("id, sender_id, body, created_at").single();
    if (data) setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as RMsg]));
    setBody("");
  }

  async function leave() {
    const supabase = createClient();
    if (userId) await supabase.from("room_participants").delete().eq("room_id", id).eq("user_id", userId);
    router.push("/ignite");
  }

  const color = room ? KIND_COLOR[room.kind] : "var(--flame)";

  return (
    <div className="-mt-2">
      <div className="sticky z-30 -mx-4 px-4 py-2.5 flex items-center gap-3 glass" style={{ top: "52px", borderBottom: "1px solid var(--line)" }}>
        <button onClick={leave} aria-label="Leave" className="w-8 h-8 grid place-items-center rounded-full -ml-1" style={{ color: "var(--ink-60)" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ color: "var(--ink-1)" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, animation: "pulse-dot 1.3s infinite" }} />
            {room?.title ?? "…"}
          </div>
          <div className="font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>{count} in room · live</div>
        </div>
        <button onClick={leave} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>Leave</button>
      </div>

      {room?.is_stream && (
        <div className="mt-3">
          <LivestreamStage roomId={id} hostId={room.host_id} meId={userId} hostName={names[room.host_id] || "Host"} />
        </div>
      )}

      {room?.topic && (
        <div className="mt-3 rounded-2xl px-4 py-3 font-display italic text-[15px]" style={{ background: `${color}12`, border: `1px solid ${color}33`, color: "var(--ink-1)" }}>
          “{room.topic}”
        </div>
      )}

      <div className="py-4 space-y-3" style={{ paddingBottom: "96px" }}>
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]" style={{ background: "#FFF6EC", border: "1px solid var(--amber)", color: "var(--ink-60)", lineHeight: 1.4 }}>
          <span>🛡️</span><span>{SAFETY_RULE}</span>
        </div>
        {loading && <div className="h-10 w-2/3 rounded-2xl skeleton" />}
        {!loading && messages.length === 0 && (
          <div className="text-center py-8"><p className="font-display italic text-lg" style={{ color: "var(--ink-60)" }}>The floor is yours. Say something.</p></div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="w-7 h-7 rounded-full grid place-items-center text-white text-[11px] font-bold shrink-0 mt-0.5" style={{ background: `linear-gradient(135deg, ${color}, var(--amber))` }}>
                  {(names[m.sender_id] || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="max-w-[76%]">
                {!mine && <div className="font-label mb-0.5 ml-1" style={{ fontSize: "9px", color: "var(--ink-40)" }}>{names[m.sender_id] || "someone"}</div>}
                <div className="px-3.5 py-2.5 text-sm leading-relaxed animate-fade"
                  style={mine
                    ? { background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", color: "#fff", borderRadius: "16px 16px 4px 16px" }
                    : { background: "var(--paper)", color: "var(--ink-1)", border: "1px solid var(--line)", borderRadius: "16px 16px 16px 4px" }}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="fixed inset-x-0 z-40 flex flex-col items-center px-4" style={{ bottom: "calc(var(--nav-h) + 6px)" }}>
        {safetyWarn && (
          <div className="w-full max-w-[560px] mb-2 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", lineHeight: 1.45 }}>
            {safetyWarn}
          </div>
        )}
        <div className="w-full max-w-[560px] flex items-end gap-2 p-1.5 rounded-[24px] glass" style={{ border: "1px solid var(--line-2)", boxShadow: "var(--shadow-lg)" }}>
          <textarea value={body} onChange={(e) => { setBody(e.target.value); if (safetyWarn) setSafetyWarn(""); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1} maxLength={2000} placeholder="Say it to the room…" className="flex-1 resize-none bg-transparent focus:outline-none text-sm px-3 py-2 max-h-28" style={{ color: "var(--ink-1)" }} />
          <button onClick={send} disabled={!body.trim()} aria-label="Send"
            className="w-10 h-10 rounded-full grid place-items-center text-white shrink-0 active:scale-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
