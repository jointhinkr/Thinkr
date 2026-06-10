"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Circle } from "@/lib/types";

export default function CirclesPage() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [myCircleIds, setMyCircleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data } = await supabase
      .from("circles")
      .select()
      .order("created_at", { ascending: false });
    setCircles(data ?? []);

    if (user) {
      const { data: memberships } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id);
      setMyCircleIds(new Set((memberships ?? []).map((m: { circle_id: string }) => m.circle_id)));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function join(circleId: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("circle_members").insert({ circle_id: circleId, user_id: userId });
    setMyCircleIds((s) => new Set([...s, circleId]));
  }

  async function leave(circleId: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", userId);
    setMyCircleIds((s) => { const n = new Set(s); n.delete(circleId); return n; });
  }

  async function createCircle() {
    if (!form.name.trim() || !userId) return;
    setPosting(true);
    const supabase = createClient();
    const slug = form.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const { data, error } = await supabase
      .from("circles")
      .insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        slug,
        creator_id: userId,
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("circle_members").insert({
        circle_id: data.id,
        user_id: userId,
        role: "organizer",
      });
      setCreating(false);
      setForm({ name: "", description: "" });
      router.push(`/circles/${data.slug}`);
    }
    setPosting(false);
  }

  if (loading) {
    return <div className="text-center py-20 opacity-30 text-sm">Loading circles…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <span
            className="text-xs tracking-widest opacity-40"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            CIRCLES
          </span>
          <h1
            className="text-2xl mt-0.5"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Topic communities
          </h1>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: "var(--flame)" }}
        >
          {creating ? "cancel" : "+ new"}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl bg-white border border-black/6 px-5 py-4 space-y-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Circle name"
            maxLength={60}
            className="w-full text-sm bg-transparent border-b border-black/10 pb-2 focus:outline-none"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What's it about? (optional)"
            maxLength={200}
            rows={2}
            className="w-full resize-none text-sm bg-transparent focus:outline-none placeholder:opacity-30"
          />
          <div className="flex justify-end">
            <button
              onClick={createCircle}
              disabled={posting || !form.name.trim()}
              className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40"
              style={{ background: "var(--flame)" }}
            >
              {posting ? "creating…" : "create circle"}
            </button>
          </div>
        </div>
      )}

      {circles.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p className="text-sm">No circles yet — create one above.</p>
        </div>
      )}

      {circles.map((c) => {
        const isMember = myCircleIds.has(c.id);
        return (
          <div
            key={c.id}
            className="rounded-2xl bg-white border border-black/6 px-5 py-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1">
              <Link
                href={`/circles/${c.slug}`}
                className="font-medium hover:underline"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {c.name}
              </Link>
              {c.description && (
                <p className="text-xs opacity-50 mt-1">{c.description}</p>
              )}
            </div>
            <button
              onClick={() => isMember ? leave(c.id) : join(c.id)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={
                isMember
                  ? { borderColor: "var(--flame)", color: "var(--flame)" }
                  : { borderColor: "var(--ink)", opacity: 0.4 }
              }
            >
              {isMember ? "joined" : "join"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
