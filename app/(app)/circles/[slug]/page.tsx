"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThoughtCard from "@/components/thought-card";
import ThoughtComposer from "@/components/thought-composer";
import type { Circle, ThoughtWithMeta } from "@/lib/types";

export default function CirclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [thoughts, setThoughts] = useState<ThoughtWithMeta[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchTarget, setBranchTarget] = useState<ThoughtWithMeta | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: c } = await supabase
      .from("circles")
      .select()
      .eq("slug", slug)
      .single();

    if (!c) { router.push("/circles"); return; }
    setCircle(c);

    if (user) {
      const { data: membership } = await supabase
        .from("circle_members")
        .select()
        .eq("circle_id", c.id)
        .eq("user_id", user.id)
        .single();
      setIsMember(!!membership);
    }

    const { data: rows } = await supabase
      .from("thoughts")
      .select("*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
      .eq("circle_id", c.id)
      .order("created_at", { ascending: false })
      .limit(40);

    if (!rows) { setLoading(false); return; }

    let resonatedSet = new Set<string>();
    if (user) {
      const { data: res } = await supabase
        .from("resonances")
        .select("thought_id")
        .eq("user_id", user.id)
        .in("thought_id", rows.map((r) => r.id));
      resonatedSet = new Set((res ?? []).map((r: { thought_id: string }) => r.thought_id));
    }

    const { data: branches } = await supabase
      .from("thoughts")
      .select("parent_id")
      .in("parent_id", rows.map((r) => r.id));

    const branchCounts: Record<string, number> = {};
    (branches ?? []).forEach((b: { parent_id: string }) => {
      branchCounts[b.parent_id] = (branchCounts[b.parent_id] ?? 0) + 1;
    });

    setThoughts(
      rows.map((r) => ({
        ...r,
        author: r.author,
        resonated: resonatedSet.has(r.id),
        branch_count: branchCounts[r.id] ?? 0,
      }))
    );
    setLoading(false);
  }, [slug, router]);

  useEffect(() => { load(); }, [load]);

  async function joinOrLeave() {
    if (!userId || !circle) return;
    const supabase = createClient();
    if (isMember) {
      await supabase
        .from("circle_members")
        .delete()
        .eq("circle_id", circle.id)
        .eq("user_id", userId);
      setIsMember(false);
    } else {
      await supabase.from("circle_members").insert({
        circle_id: circle.id,
        user_id: userId,
      });
      setIsMember(true);
    }
  }

  async function openChat() {
    if (!circle) return;
    const supabase = createClient();
    const { data } = await supabase.rpc("open_circle_conversation", { circle: circle.id });
    if (data) router.push(`/echo/${data}`);
  }

  if (loading) {
    return <div className="text-center py-20 opacity-30 text-sm">Loading…</div>;
  }

  if (!circle) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span
            className="text-xs tracking-widest opacity-40"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            CIRCLE
          </span>
          <h1
            className="text-2xl mt-0.5"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {circle.name}
          </h1>
          {circle.description && (
            <p className="text-sm opacity-50 mt-1">{circle.description}</p>
          )}
        </div>
        <button
          onClick={joinOrLeave}
          className="shrink-0 mt-1 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors"
          style={
            isMember
              ? { borderColor: "var(--flame)", color: "var(--flame)" }
              : { background: "var(--flame)", color: "#fff", border: "none" }
          }
        >
          {isMember ? "joined ✓" : "join"}
        </button>
      </div>

      {isMember && (
        <button onClick={openChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-[0.99] transition-transform"
          style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-11.6 7.8L4 20.5l1.3-4A8.4 8.4 0 1 1 21 11.5Z" />
          </svg>
          Open circle chat
        </button>
      )}

      {isMember && (
        <>
          <ThoughtComposer
            circleId={circle.id}
            onPosted={load}
          />
          {branchTarget && (
            <ThoughtComposer
              circleId={circle.id}
              parentThought={branchTarget}
              onPosted={() => { setBranchTarget(null); load(); }}
              onCancel={() => setBranchTarget(null)}
            />
          )}
        </>
      )}

      {thoughts.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p className="text-sm">No thoughts here yet.</p>
          {isMember && <p className="text-xs mt-1">Be the first to share one.</p>}
        </div>
      )}

      {thoughts.map((t) => (
        <ThoughtCard
          key={t.id}
          thought={t}
          onBranch={isMember ? (parent) => setBranchTarget(parent) : undefined}
        />
      ))}
    </div>
  );
}
