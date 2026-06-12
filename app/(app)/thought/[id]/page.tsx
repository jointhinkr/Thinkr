"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import RichText from "@/components/rich-text";
import type { ThoughtWithMeta } from "@/lib/types";

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type Node = ThoughtWithMeta;

function branch(node: Node) {
  window.dispatchEvent(new CustomEvent("thinkr:compose", { detail: { parentId: node.id, parentBody: node.body } }));
}

function BranchNode({
  node, childrenMap, depth, userId, resonatedSet,
}: {
  node: Node;
  childrenMap: Record<string, Node[]>;
  depth: number;
  userId: string | null;
  resonatedSet: Set<string>;
}) {
  const [resonated, setResonated] = useState(resonatedSet.has(node.id));
  const [busy, setBusy] = useState(false);
  const kids = childrenMap[node.id] ?? [];
  const name = node.author.display_name || node.author.username;

  async function toggleResonance() {
    if (busy || !userId) return;
    setBusy(true);
    const supabase = createClient();
    const next = !resonated;
    setResonated(next);
    if (next) await supabase.from("resonances").insert({ user_id: userId, thought_id: node.id });
    else await supabase.from("resonances").delete().eq("user_id", userId).eq("thought_id", node.id);
    setBusy(false);
  }

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0, borderLeft: depth > 0 ? "2px solid var(--line)" : undefined, paddingLeft: depth > 0 ? 10 : 0 }}>
      <div className="rounded-2xl px-4 py-3 mb-2" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Link href={`/profile/${node.author.username}`} className="flex items-center gap-2">
            <Avatar name={name} src={node.author.avatar_url} size={24} />
            <span className="text-xs font-medium" style={{ color: "var(--ink-1)" }}>{name}</span>
          </Link>
          <span className="text-xs" style={{ color: "var(--ink-40)" }}>· {timeAgo(node.created_at)}</span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-1)" }}><RichText text={node.body} /></p>
        <div className="flex items-center gap-4 mt-2">
          <button onClick={toggleResonance} disabled={busy} className="flex items-center gap-1 text-xs" style={{ color: resonated ? "var(--flame)" : "var(--ink-40)" }}>
            <span>{resonated ? "◆" : "◇"}</span><span>{resonated ? "resonating" : "resonate"}</span>
          </button>
          <button onClick={() => branch(node)} className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-40)" }}>
            <span>↳</span><span>branch</span>
          </button>
        </div>
      </div>
      {kids.map((k) => (
        <BranchNode key={k.id} node={k} childrenMap={childrenMap} depth={depth + 1} userId={userId} resonatedSet={resonatedSet} />
      ))}
    </div>
  );
}

export default function ThoughtThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [root, setRoot] = useState<Node | null>(null);
  const [childrenMap, setChildrenMap] = useState<Record<string, Node[]>>({});
  const [resonatedSet, setResonatedSet] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const sel = "*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)";
    const { data: rootRow } = await supabase.from("thoughts").select(sel).eq("id", id).single();
    if (!rootRow) { setNotFound(true); setLoading(false); return; }

    // BFS over branches (children whose parent_id chains back to root).
    const all: Node[] = [];
    let frontier = [id];
    for (let depth = 0; depth < 8 && frontier.length; depth++) {
      const { data: kids } = await supabase.from("thoughts").select(sel).in("parent_id", frontier).order("created_at", { ascending: true });
      if (!kids || kids.length === 0) break;
      all.push(...(kids as Node[]));
      frontier = kids.map((k) => k.id);
    }

    let visible = all;
    if (user) {
      const { data: blk } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
      const blocked = new Set((blk ?? []).map((b: { blocked_id: string }) => b.blocked_id));
      visible = all.filter((n) => !blocked.has(n.author_id));
    }

    const map: Record<string, Node[]> = {};
    visible.forEach((n) => { if (n.parent_id) (map[n.parent_id] ??= []).push(n); });

    if (user) {
      const ids = [id, ...visible.map((n) => n.id)];
      const { data: res } = await supabase.from("resonances").select("thought_id").eq("user_id", user.id).in("thought_id", ids);
      setResonatedSet(new Set((res ?? []).map((r: { thought_id: string }) => r.thought_id)));
    }

    setRoot({ ...(rootRow as Node), author: (rootRow as Node).author });
    setChildrenMap(map);
    setCount(visible.length);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onPosted = () => load();
    window.addEventListener("thinkr:posted", onPosted);
    return () => window.removeEventListener("thinkr:posted", onPosted);
  }, [load]);

  if (loading) return <div className="text-center py-20 opacity-30 text-sm">Loading thread…</div>;
  if (notFound || !root) return <div className="text-center py-20 opacity-40 text-sm">This thought no longer exists.</div>;

  const rootName = root.author.display_name || root.author.username;
  const rootKids = childrenMap[root.id] ?? [];

  return (
    <div className="space-y-4">
      <Link href="/flux" className="font-label inline-flex items-center gap-1" style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-40)" }}>← FLUX</Link>

      {/* root post */}
      <div className="rounded-2xl px-5 py-5" style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
        <Link href={`/profile/${root.author.username}`} className="flex items-center gap-2.5 mb-3">
          <Avatar name={rootName} src={root.author.avatar_url} size={36} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--ink-1)" }}>{rootName}</div>
            <div className="font-label" style={{ fontSize: "10px", color: "var(--ink-40)" }}>@{root.author.username} · {timeAgo(root.created_at)}</div>
          </div>
        </Link>
        <p className="font-display text-[19px] leading-snug whitespace-pre-wrap" style={{ color: "var(--ink-1)" }}><RichText text={root.body} /></p>
        <button onClick={() => branch(root)} className="mt-4 px-4 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
          ↳ Branch this thought
        </button>
      </div>

      <div className="label-xs">{count} branch{count !== 1 ? "es" : ""}</div>

      {rootKids.length === 0 ? (
        <div className="text-center py-8 opacity-40 text-sm">No branches yet. Start the thread.</div>
      ) : (
        <div>
          {rootKids.map((k) => (
            <BranchNode key={k.id} node={k} childrenMap={childrenMap} depth={0} userId={userId} resonatedSet={resonatedSet} />
          ))}
        </div>
      )}
    </div>
  );
}
