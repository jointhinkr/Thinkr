"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type Req = {
  id: string;
  created_at: string;
  requester: Pick<Profile, "id" | "username" | "display_name">;
};
type Conv = {
  id: string;
  isGroup: boolean;
  title: string | null;
  memberCount: number;
  other: Pick<Profile, "id" | "username" | "display_name"> | null;
  last: string | null;
  lastAt: string | null;
  fromMe: boolean;
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function EchoPage() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: reqs } = await supabase
      .from("connection_requests")
      .select("id, created_at, requester:profiles!connection_requests_requester_id_fkey(id, username, display_name)")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setRequests((reqs as unknown as Req[]) ?? []);

    const { data: mems } = await supabase
      .from("conversation_members").select("conversation_id").eq("user_id", user.id);
    const ids = (mems ?? []).map((m: { conversation_id: string }) => m.conversation_id);

    if (ids.length === 0) { setConvs([]); setLoading(false); return; }

    const { data: convRows } = await supabase.from("conversations").select("id, is_group, title").in("id", ids);
    const meta: Record<string, { is_group: boolean; title: string | null }> = {};
    (convRows ?? []).forEach((c: { id: string; is_group: boolean; title: string | null }) => { meta[c.id] = { is_group: c.is_group, title: c.title }; });

    const { data: others } = await supabase
      .from("conversation_members")
      .select("conversation_id, user:profiles!conversation_members_user_id_fkey(id, username, display_name)")
      .in("conversation_id", ids)
      .neq("user_id", user.id);
    const othersByConv: Record<string, Pick<Profile, "id" | "username" | "display_name">[]> = {};
    ((others ?? []) as unknown as Array<{ conversation_id: string; user: Pick<Profile, "id" | "username" | "display_name"> }>).forEach((o) => {
      (othersByConv[o.conversation_id] ??= []).push(o.user);
    });

    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at, sender_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    const lastByConv: Record<string, { body: string; created_at: string; sender_id: string }> = {};
    (msgs ?? []).forEach((m: { conversation_id: string; body: string; created_at: string; sender_id: string }) => {
      if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
    });

    const list: Conv[] = ids.map((cid) => {
      const m = meta[cid] ?? { is_group: false, title: null };
      const mems = othersByConv[cid] ?? [];
      const last = lastByConv[cid];
      return {
        id: cid,
        isGroup: m.is_group,
        title: m.title,
        memberCount: mems.length + 1,
        other: m.is_group ? null : (mems[0] ?? null),
        last: last?.body ?? null,
        lastAt: last?.created_at ?? null,
        fromMe: last?.sender_id === user.id,
      };
    });
    list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    setConvs(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function respond(reqId: string, accept: boolean) {
    setBusy(reqId);
    const supabase = createClient();
    await supabase.rpc("respond_to_connection", { req: reqId, accept });
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="label-xs">Echo</span>
        <h1 className="font-display text-3xl mt-0.5" style={{ color: "var(--ink-1)" }}>
          Your bonds
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-60)" }}>
          Connections form when both minds say yes. Then you talk.
        </p>
      </div>

      <Link href="/gather" className="flex items-center justify-between rounded-2xl p-4 active:scale-[0.99] transition-transform"
        style={{ background: "linear-gradient(135deg, rgba(247,178,76,0.18), rgba(244,74,38,0.08))", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🌿</span>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--ink-1)" }}>Gather</div>
            <div className="text-xs" style={{ color: "var(--ink-60)" }}>Meet your people in real life</div>
          </div>
        </div>
        <span style={{ color: "var(--flame)" }}>→</span>
      </Link>

      {requests.length > 0 && (
        <div className="space-y-2.5">
          <span className="label-xs">Requests to connect</span>
          {requests.map((r) => {
            const name = r.requester.display_name || r.requester.username;
            return (
              <div key={r.id} className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
                <div className="w-11 h-11 rounded-full grid place-items-center text-white font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--flame), var(--amber))" }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "var(--ink-1)" }}>{name}</div>
                  <div className="font-label" style={{ fontSize: "10px", color: "var(--ink-40)" }}>
                    wants to form a bond · {timeAgo(r.created_at)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => respond(r.id, false)} disabled={busy === r.id}
                    className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ color: "var(--ink-40)" }}>
                    decline
                  </button>
                  <button onClick={() => respond(r.id, true)} disabled={busy === r.id}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))" }}>
                    {busy === r.id ? "…" : "accept"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        {convs.length > 0 && <span className="label-xs">Conversations</span>}
        {loading && <div className="h-16 rounded-2xl skeleton" />}

        {!loading && convs.length === 0 && requests.length === 0 && (
          <div className="text-center py-16 px-6 animate-rise">
            <div className="font-display italic text-2xl mb-2" style={{ color: "var(--ink-1)" }}>No bonds yet.</div>
            <p className="text-sm mb-5" style={{ color: "var(--ink-60)" }}>
              Find your Thought Twin and send a request to connect.
            </p>
            <Link href="/twin" className="inline-block px-5 py-2.5 rounded-full text-white text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" }}>
              Find your Twin →
            </Link>
          </div>
        )}

        {convs.map((c) => {
          const name = c.isGroup ? (c.title || "Circle chat") : (c.other ? (c.other.display_name || c.other.username) : "Conversation");
          return (
            <Link key={c.id} href={`/echo/${c.id}`}
              className="flex items-center gap-3 p-3 rounded-2xl transition-colors"
              style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="w-12 h-12 rounded-full grid place-items-center text-white font-bold shrink-0"
                style={{ background: c.isGroup ? "linear-gradient(135deg, var(--amber), var(--flame))" : "linear-gradient(135deg, var(--flame), var(--amber))" }}>
                {c.isGroup ? "◎" : name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: "var(--ink-1)" }}>
                    {name}
                    {c.isGroup && <span className="ml-1.5 font-label" style={{ fontSize: "9px", color: "var(--ink-40)" }}>GROUP · {c.memberCount}</span>}
                  </span>
                  {c.lastAt && <span className="font-label shrink-0" style={{ fontSize: "10px", color: "var(--ink-40)" }}>{timeAgo(c.lastAt)}</span>}
                </div>
                <div className="text-xs truncate mt-0.5" style={{ color: "var(--ink-60)" }}>
                  {c.last ? `${c.fromMe ? "You: " : ""}${c.last}` : "Say the first thing."}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
