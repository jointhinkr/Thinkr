"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import ThoughtCard from "@/components/thought-card";
import ThoughtComposer from "@/components/thought-composer";
import type { ThoughtWithMeta } from "@/lib/types";

export default function FeedPage() {
  const [thoughts, setThoughts] = useState<ThoughtWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchTarget, setBranchTarget] = useState<ThoughtWithMeta | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: rows } = await supabase
      .from("thoughts")
      .select("*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
      .is("circle_id", null)
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
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1
          className="text-2xl"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Feed
        </h1>
        <span
          className="text-xs opacity-30"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          no likes · no counts
        </span>
      </div>

      <ThoughtComposer onPosted={load} />

      {branchTarget && (
        <ThoughtComposer
          parentThought={branchTarget}
          onPosted={() => { setBranchTarget(null); load(); }}
          onCancel={() => setBranchTarget(null)}
        />
      )}

      {loading && (
        <div className="text-center py-12 opacity-30 text-sm">Loading…</div>
      )}

      {!loading && thoughts.length === 0 && (
        <div className="text-center py-12 opacity-40">
          <p className="text-sm">No thoughts yet.</p>
          <p className="text-xs mt-1">Be the first to share one above.</p>
        </div>
      )}

      {thoughts.map((t) => (
        <ThoughtCard
          key={t.id}
          thought={t}
          onBranch={(parent) => {
            setBranchTarget(parent);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ))}
    </div>
  );
}
