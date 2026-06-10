"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type Gathering = {
  id: string; title: string; topic: string | null; city: string | null; location: string | null;
  starts_at: string; host: Pick<Profile, "username" | "display_name">; count: number; going: boolean;
};

function whenLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function GatherPage() {
  const [items, setItems] = useState<Gathering[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", topic: "", city: "", location: "", starts_at: "" });
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    const { data: rows } = await supabase
      .from("gatherings")
      .select("id, title, topic, city, location, starts_at, host:profiles!gatherings_host_id_fkey(username, display_name)")
      .gte("starts_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString())
      .order("starts_at", { ascending: true });
    if (!rows) { setLoading(false); return; }
    const { data: rsvps } = await supabase.from("gathering_rsvps").select("gathering_id, user_id").in("gathering_id", rows.map((r) => r.id));
    const counts: Record<string, number> = {}; const mine = new Set<string>();
    (rsvps ?? []).forEach((r: { gathering_id: string; user_id: string }) => {
      counts[r.gathering_id] = (counts[r.gathering_id] ?? 0) + 1;
      if (r.user_id === user?.id) mine.add(r.gathering_id);
    });
    setItems(rows.map((r) => ({ ...r, host: r.host as unknown as Gathering["host"], count: counts[r.id] ?? 0, going: mine.has(r.id) })) as Gathering[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleRsvp(g: Gathering) {
    if (!userId || busy) return;
    setBusy(g.id);
    const supabase = createClient();
    if (g.going) await supabase.from("gathering_rsvps").delete().eq("gathering_id", g.id).eq("user_id", userId);
    else await supabase.from("gathering_rsvps").insert({ gathering_id: g.id, user_id: userId });
    setItems((arr) => arr.map((x) => x.id === g.id ? { ...x, going: !x.going, count: x.count + (x.going ? -1 : 1) } : x));
    setBusy(null);
  }

  async function create() {
    if (!form.title.trim() || !form.starts_at || posting) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }
    const { error } = await supabase.from("gatherings").insert({
      title: form.title.trim(), topic: form.topic.trim() || null, city: form.city.trim() || null,
      location: form.location.trim() || null, starts_at: new Date(form.starts_at).toISOString(), host_id: user.id,
    });
    if (!error) { setCreating(false); setForm({ title: "", topic: "", city: "", location: "", starts_at: "" }); load(); }
    setPosting(false);
  }

  const fld = "w-full text-sm bg-transparent focus:outline-none placeholder:opacity-40";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/echo" className="font-label" style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-40)" }}>← ECHO</Link>
          <h1 className="font-display text-3xl mt-0.5" style={{ color: "var(--ink-1)" }}>Gather</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>Meet your people in the real world.</p>
        </div>
        <button onClick={() => setCreating((c) => !c)} className="shrink-0 px-4 py-2 rounded-full text-white text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>{creating ? "cancel" : "+ host"}</button>
      </div>

      {creating && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Gathering title" maxLength={140}
            className="w-full text-[15px] bg-transparent border-b pb-2 focus:outline-none" style={{ borderColor: "var(--line)" }} />
          <input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="What will you talk about?" maxLength={200} className={fld} />
          <div className="flex gap-2">
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" className={fld} />
            <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Spot / address" className={fld} />
          </div>
          <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
            className="w-full text-sm rounded-lg px-3 py-2" style={{ background: "#fff", border: "1px solid var(--line)", color: "var(--ink-1)" }} />
          <div className="flex justify-end">
            <button onClick={create} disabled={posting || !form.title.trim() || !form.starts_at}
              className="px-4 py-2 rounded-full text-white text-sm font-semibold disabled:opacity-40" style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
              {posting ? "posting…" : "post gathering"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="h-24 rounded-2xl skeleton" />}
      {!loading && items.length === 0 && (
        <div className="text-center py-14 px-6">
          <div className="text-3xl mb-2">🌿</div>
          <div className="font-display italic text-2xl mb-1" style={{ color: "var(--ink-1)" }}>Nothing on the calendar.</div>
          <p className="text-sm" style={{ color: "var(--ink-60)" }}>Host the first gathering.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((g) => (
          <div key={g.id} className="rounded-2xl p-4" style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-[17px] leading-snug" style={{ color: "var(--ink-1)" }}>{g.title}</div>
                {g.topic && <p className="text-sm mt-1 italic font-display" style={{ color: "var(--ink-60)" }}>{g.topic}</p>}
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded-full font-label text-center" style={{ fontSize: "9px", letterSpacing: "0.06em", background: "rgba(244,74,38,0.1)", color: "var(--flame)" }}>
                {whenLabel(g.starts_at)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs" style={{ color: "var(--ink-40)" }}>
                {[g.location, g.city].filter(Boolean).join(", ") || "location TBA"} · {g.count} going
              </div>
              <button onClick={() => toggleRsvp(g)} disabled={busy === g.id}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={g.going ? { background: "var(--flame)", color: "#fff" } : { border: "1.5px solid var(--flame)", color: "var(--flame)" }}>
                {g.going ? "going ✓" : "RSVP"}
              </button>
            </div>
            <div className="text-xs mt-2" style={{ color: "var(--ink-40)" }}>hosted by {g.host.display_name || g.host.username}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
