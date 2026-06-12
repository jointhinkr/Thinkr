"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

type Person = { id: string; username: string; display_name: string | null; avatar_url: string | null; suspended?: boolean | null };
type Post = { id: string; body: string; author: { id: string; username: string; display_name: string | null; avatar_url: string | null } };
type Tab = "people" | "thoughts" | "tags";

const sanitize = (s: string) => s.replace(/[%,]/g, "").trim();

// Search overlay for Flux: accounts, posts, and hashtags.
export default function FluxSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const blockedRef = useRef<Set<string>>(new Set());
  const meRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      meRef.current = user?.id ?? null;
      if (user) {
        const { data: blk } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
        blockedRef.current = new Set((blk ?? []).map((b: { blocked_id: string }) => b.blocked_id));
      }
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    const term = sanitize(q);
    if (term.length < 1) { setPeople([]); setPosts([]); setTags([]); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const blocked = blockedRef.current;
      const me = meRef.current;
      const [{ data: ppl }, { data: th }, { data: tg }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url, suspended")
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(12),
        supabase.from("thoughts").select("id, body, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
          .ilike("body", `%${term}%`).is("circle_id", null).order("created_at", { ascending: false }).limit(15),
        supabase.from("thoughts").select("id, body, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
          .ilike("body", `%#${term}%`).is("circle_id", null).order("created_at", { ascending: false }).limit(15),
      ]);
      setPeople(((ppl ?? []) as Person[]).filter((p) => !p.suspended && !blocked.has(p.id) && p.id !== me));
      setPosts(((th ?? []) as unknown as Post[]).filter((p) => !blocked.has(p.author.id)));
      setTags(((tg ?? []) as unknown as Post[]).filter((p) => !blocked.has(p.author.id)));
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  function close() { setOpen(false); setQ(""); setPeople([]); setPosts([]); setTags([]); setTab("people"); }

  const counts: Record<Tab, number> = { people: people.length, thoughts: posts.length, tags: tags.length };
  const active = tab === "people" ? null : tab === "thoughts" ? posts : tags;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Search"
        className="fixed z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full glass active:scale-95 transition-transform"
        style={{ top: "62px", left: 12, border: "1px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="var(--ink-60)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
        </svg>
        <span className="font-label" style={{ fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-60)" }}>SEARCH</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]" style={{ background: "var(--cream)" }}>
          <div className="mx-auto w-full max-w-[560px] h-full flex flex-col">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
              <div className="flex-1 flex items-center gap-2 rounded-full px-4 py-2.5" style={{ background: "var(--paper)", border: "1.5px solid var(--line)" }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="var(--ink-40)" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
                </svg>
                <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search people, thoughts, #tags"
                  className="flex-1 bg-transparent text-[15px] focus:outline-none" style={{ color: "var(--ink-1)" }} />
              </div>
              <button onClick={close} className="text-sm font-semibold px-2" style={{ color: "var(--flame)" }}>Close</button>
            </div>

            <div className="flex gap-1.5 px-4 pb-2">
              {(["people", "thoughts", "tags"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors"
                  style={tab === t
                    ? { background: "var(--flame)", color: "#fff" }
                    : { background: "var(--paper)", color: "var(--ink-60)", border: "1px solid var(--line)" }}>
                  {t === "tags" ? "#Tags" : t}{counts[t] ? ` ${counts[t]}` : ""}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {sanitize(q).length < 1 ? (
                <p className="text-center text-sm mt-10" style={{ color: "var(--ink-40)" }}>
                  Find people by name, thoughts by what they say, or topics by #tag.
                </p>
              ) : loading && counts[tab] === 0 ? (
                <p className="text-center text-sm mt-10" style={{ color: "var(--ink-40)" }}>Searching…</p>
              ) : tab === "people" ? (
                people.length === 0 ? <Empty label="No people found." /> : (
                  <div className="space-y-2">
                    {people.map((p) => (
                      <Link key={p.id} href={`/profile/${p.username}`} onClick={close}
                        className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                        <Avatar name={p.display_name || p.username} src={p.avatar_url} size={40} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: "var(--ink-1)" }}>{p.display_name || p.username}</div>
                          <div className="text-xs truncate" style={{ color: "var(--ink-40)", fontFamily: "'Space Mono', monospace" }}>@{p.username}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : active && active.length === 0 ? (
                <Empty label={tab === "tags" ? `No thoughts tagged #${sanitize(q)}.` : "No thoughts found."} />
              ) : (
                <div className="space-y-2">
                  {(active ?? []).map((p) => (
                    <Link key={p.id} href={`/profile/${p.author.username}`} onClick={close}
                      className="block rounded-2xl px-4 py-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Avatar name={p.author.display_name || p.author.username} src={p.author.avatar_url} size={24} />
                        <span className="text-xs font-medium" style={{ color: "var(--ink-1)" }}>{p.author.display_name || p.author.username}</span>
                        <span className="text-xs" style={{ color: "var(--ink-40)", fontFamily: "'Space Mono', monospace" }}>@{p.author.username}</span>
                      </div>
                      <p className="text-sm line-clamp-3" style={{ color: "var(--ink-1)" }}>{p.body}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-center text-sm mt-10" style={{ color: "var(--ink-40)" }}>{label}</p>;
}
