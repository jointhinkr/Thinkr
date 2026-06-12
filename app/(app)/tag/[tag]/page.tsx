"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThoughtCard from "@/components/thought-card";
import type { ThoughtWithMeta } from "@/lib/types";

export default function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params);
  const clean = decodeURIComponent(tag).toLowerCase().replace(/[^a-z0-9_]/g, "");
  const [thoughts, setThoughts] = useState<ThoughtWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: rows } = await supabase
        .from("thoughts")
        .select("*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
        .ilike("body", `%#${clean}%`)
        .is("circle_id", null)
        .order("created_at", { ascending: false })
        .limit(60);

      // Word-boundary filter so #stem doesn't match #stemcell.
      const wordRe = new RegExp(`#${clean}(?![a-z0-9_])`, "i");
      let list = (rows ?? []).filter((r) => wordRe.test(r.body));

      if (user) {
        const { data: blk } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
        const blocked = new Set((blk ?? []).map((b: { blocked_id: string }) => b.blocked_id));
        list = list.filter((r) => !blocked.has(r.author_id));
      }

      let resonatedSet = new Set<string>();
      if (user && list.length) {
        const { data: res } = await supabase.from("resonances").select("thought_id").eq("user_id", user.id).in("thought_id", list.map((r) => r.id));
        resonatedSet = new Set((res ?? []).map((r: { thought_id: string }) => r.thought_id));
      }
      const { data: branches } = await supabase.from("thoughts").select("parent_id").in("parent_id", list.map((r) => r.id));
      const bc: Record<string, number> = {};
      (branches ?? []).forEach((b: { parent_id: string }) => { bc[b.parent_id] = (bc[b.parent_id] ?? 0) + 1; });

      setThoughts(list.map((r) => ({ ...r, author: r.author, resonated: resonatedSet.has(r.id), branch_count: bc[r.id] ?? 0 })));
      setLoading(false);
    })();
  }, [clean]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/flux" className="font-label inline-flex items-center gap-1" style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-40)" }}>← FLUX</Link>
        <h1 className="font-display text-3xl mt-0.5" style={{ color: "var(--flame)" }}>#{clean}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>Thoughts tagged #{clean}.</p>
      </div>

      {loading ? (
        <div className="h-24 rounded-2xl skeleton" />
      ) : thoughts.length === 0 ? (
        <div className="text-center py-12 opacity-40 text-sm">No thoughts tagged #{clean} yet.</div>
      ) : (
        <div className="space-y-3">
          {thoughts.map((t) => <ThoughtCard key={t.id} thought={t} />)}
        </div>
      )}
    </div>
  );
}
