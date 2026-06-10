"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const KINDS = [
  { v: "debate", label: "Debate", color: "#F44A26" },
  { v: "study", label: "Study", color: "#C9821E" },
  { v: "chill", label: "Chill", color: "#B6791B" },
  { v: "open", label: "Open floor", color: "#E5604B" },
];
const kindOf = (v: string) => KINDS.find((k) => k.v === v) ?? KINDS[3];

type Room = {
  id: string; title: string; topic: string | null; kind: string;
  host: Pick<Profile, "username" | "display_name">; count: number;
};

export default function IgnitePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", topic: "", kind: "open" });
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("live_rooms")
      .select("id, title, topic, kind, host:profiles!live_rooms_host_id_fkey(username, display_name)")
      .eq("is_live", true)
      .order("created_at", { ascending: false });
    if (!rows) { setLoading(false); return; }
    const { data: parts } = await supabase.from("room_participants").select("room_id").in("room_id", rows.map((r) => r.id));
    const counts: Record<string, number> = {};
    (parts ?? []).forEach((p: { room_id: string }) => { counts[p.room_id] = (counts[p.room_id] ?? 0) + 1; });
    setRooms(rows.map((r) => ({ ...r, host: (r.host as unknown as Room["host"]), count: counts[r.id] ?? 0 })) as Room[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createRoom() {
    if (!form.title.trim() || posting) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }
    const { data, error } = await supabase.from("live_rooms")
      .insert({ title: form.title.trim(), topic: form.topic.trim() || null, kind: form.kind, host_id: user.id })
      .select("id").single();
    if (!error && data) {
      await supabase.from("room_participants").insert({ room_id: data.id, user_id: user.id });
      router.push(`/ignite/${data.id}`);
    }
    setPosting(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/flux" className="font-label inline-flex items-center gap-1" style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-40)" }}>
            ← FLUX
          </Link>
          <h1 className="font-display text-3xl mt-0.5 flex items-center gap-2" style={{ color: "var(--ink-1)" }}>
            Ignite
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(244,74,38,0.1)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--flame)", animation: "pulse-dot 1.4s infinite" }} />
              <span className="font-label" style={{ fontSize: "9px", color: "var(--flame)", letterSpacing: "0.1em" }}>LIVE</span>
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>Debates, study rooms, and open floors — happening now.</p>
        </div>
        <button onClick={() => setCreating((c) => !c)} className="shrink-0 px-4 py-2 rounded-full text-white text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
          {creating ? "cancel" : "+ start"}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Room title" maxLength={140}
            className="w-full text-[15px] bg-transparent border-b pb-2 focus:outline-none" style={{ borderColor: "var(--line)" }} />
          <input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="What's the question? (optional)" maxLength={200}
            className="w-full text-sm bg-transparent focus:outline-none placeholder:opacity-40" />
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k.v} onClick={() => setForm((f) => ({ ...f, kind: k.v }))}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={form.kind === k.v ? { background: k.color, color: "#fff" } : { border: "1px solid var(--line)", color: "var(--ink-60)" }}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={createRoom} disabled={posting || !form.title.trim()}
              className="px-4 py-2 rounded-full text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
              {posting ? "starting…" : "go live"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="h-24 rounded-2xl skeleton" />}
      {!loading && rooms.length === 0 && (
        <div className="text-center py-14 px-6">
          <div className="font-display italic text-2xl mb-1" style={{ color: "var(--ink-1)" }}>Quiet on the floor.</div>
          <p className="text-sm" style={{ color: "var(--ink-60)" }}>Start the first live room above.</p>
        </div>
      )}

      <div className="space-y-3">
        {rooms.map((r) => {
          const k = kindOf(r.kind);
          return (
            <Link key={r.id} href={`/ignite/${r.id}`} className="block rounded-2xl p-4"
              style={{ background: "var(--paper)", border: `1px solid ${k.color}33`, boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label" style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: `${k.color}1a`, color: k.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: k.color, animation: "pulse-dot 1.2s infinite" }} />
                  {k.label}
                </span>
                <span className="font-label" style={{ fontSize: "10px", color: "var(--ink-40)" }}>{r.count} in room</span>
              </div>
              <div className="font-display text-[17px] leading-snug" style={{ color: "var(--ink-1)" }}>{r.title}</div>
              {r.topic && <p className="text-sm mt-1 italic font-display" style={{ color: "var(--ink-60)" }}>{r.topic}</p>}
              <div className="text-xs mt-2" style={{ color: "var(--ink-40)" }}>hosted by {r.host.display_name || r.host.username}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
