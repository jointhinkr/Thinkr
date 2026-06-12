"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThoughtCard from "@/components/thought-card";
import Avatar from "@/components/avatar";
import ProfileActions from "@/components/profile-actions";
import { uploadToBucket } from "@/lib/upload";
import type { Profile, ThoughtWithMeta } from "@/lib/types";

const AXIS_LABELS: Record<string, [string, string]> = {
  abstract_vs_concrete: ["Abstract", "Concrete"],
  optimist_vs_skeptic: ["Optimist", "Skeptic"],
  builder_vs_critic: ["Builder", "Critic"],
  solo_vs_social: ["Solo", "Social"],
  novelty_vs_depth: ["Novelty", "Depth"],
};

const BIO_MAX_WORDS = 80;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
function clampWords(s: string, max: number) {
  const w = s.split(/\s+/);
  if (w.length <= max) return s;
  return w.slice(0, max).join(" ");
}
const normalizeUsername = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [thoughts, setThoughts] = useState<ThoughtWithMeta[]>([]);
  const [tab, setTab] = useState<"posts" | "resonated">("posts");
  const [resonatedThoughts, setResonatedThoughts] = useState<ThoughtWithMeta[] | null>(null);
  const [loadingReson, setLoadingReson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMe, setIsMe] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: "", username: "", bio: "", city: "", allow_connection_requests: true, resonances_private: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setUploadingAvatar(true);
    const url = await uploadToBucket("avatars", file);
    if (url) {
      const supabase = createClient();
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      window.dispatchEvent(new CustomEvent("thinkr:avatar", { detail: url }));
    }
    setUploadingAvatar(false);
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: p } = await supabase
      .from("profiles")
      .select()
      .eq("username", username)
      .single();

    if (!p) { setLoading(false); return; }
    setProfile(p);
    setMeId(user?.id ?? null);
    setIsMe(user?.id === p.id);
    setEditForm({
      display_name: p.display_name ?? "",
      username: p.username ?? "",
      bio: p.bio ?? "",
      city: p.city ?? "",
      allow_connection_requests: p.allow_connection_requests ?? true,
      resonances_private: p.resonances_private ?? true,
    });

    const { data: rows } = await supabase
      .from("thoughts")
      .select("*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url)")
      .eq("author_id", p.id)
      .is("circle_id", null)
      .order("created_at", { ascending: false })
      .limit(30);

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

    // Real branch counts (children whose parent_id points at each thought).
    const { data: branches } = await supabase
      .from("thoughts").select("parent_id").in("parent_id", rows.map((r) => r.id));
    const bc: Record<string, number> = {};
    (branches ?? []).forEach((b: { parent_id: string }) => { bc[b.parent_id] = (bc[b.parent_id] ?? 0) + 1; });

    setThoughts(
      rows.map((r) => ({
        ...r,
        author: r.author,
        resonated: resonatedSet.has(r.id),
        branch_count: bc[r.id] ?? 0,
      }))
    );
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  // Reload when a thought is posted/edited/deleted via the global composer.
  useEffect(() => {
    const onPosted = () => load();
    window.addEventListener("thinkr:posted", onPosted);
    return () => window.removeEventListener("thinkr:posted", onPosted);
  }, [load]);

  const loadResonated = useCallback(async () => {
    if (!profile) return;
    setLoadingReson(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("resonances")
      .select("created_at, thought:thoughts!resonances_thought_id_fkey(*, author:profiles!thoughts_author_id_fkey(id, username, display_name, avatar_url))")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as unknown as Array<{ thought: ThoughtWithMeta | null }>;
    const list = rows
      .map((r) => r.thought)
      .filter((t): t is ThoughtWithMeta => !!t)
      .map((t) => ({ ...t, resonated: true, branch_count: 0 }));
    setResonatedThoughts(list);
    setLoadingReson(false);
  }, [profile]);

  // Load resonated posts lazily when the tab is first opened (respecting privacy).
  useEffect(() => {
    if (tab === "resonated" && profile && resonatedThoughts === null && !(!isMe && profile.resonances_private)) {
      loadResonated();
    }
  }, [tab, profile, isMe, resonatedThoughts, loadResonated]);

  async function saveProfile() {
    if (!profile) return;
    setFormError("");
    const uname = normalizeUsername(editForm.username);
    if (uname.length < 3) { setFormError("Username must be at least 3 characters (letters, numbers, underscores)."); return; }
    if (wordCount(editForm.bio) > BIO_MAX_WORDS) { setFormError(`Bio must be ${BIO_MAX_WORDS} words or fewer.`); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editForm.display_name || null,
        username: uname,
        bio: editForm.bio || null,
        city: editForm.city || null,
        allow_connection_requests: editForm.allow_connection_requests,
        resonances_private: editForm.resonances_private,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setFormError(/duplicate|unique/i.test(error.message) ? "That username is already taken." : error.message);
      return;
    }
    setEditing(false);
    if (uname !== profile.username) {
      router.replace(`/profile/${uname}`);
    } else {
      load();
    }
  }

  if (loading) {
    return <div className="text-center py-20 opacity-30 text-sm">Loading…</div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-20 opacity-40">
        <p className="font-medium">Thinker not found</p>
        <p className="text-sm">@{username} doesn't exist.</p>
      </div>
    );
  }

  const fp = profile.fingerprint ?? {};

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-black/6 px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar name={profile.display_name || profile.username} src={profile.avatar_url} size={56} />
              {isMe && (
                <>
                  <button onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar} aria-label="Change photo"
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full grid place-items-center text-white"
                    style={{ background: "var(--flame)", border: "2px solid #fff" }}>
                    {uploadingAvatar ? (
                      <span className="text-[10px]">…</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 4h-5L8 6H4v14h16V6h-4z" /><circle cx="12" cy="13" r="3.2" />
                      </svg>
                    )}
                  </button>
                  <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
                </>
              )}
            </div>
            {!editing ? (
              <div>
                <div className="text-xl font-medium" style={{ fontFamily: "'Fraunces', serif" }}>
                  {profile.display_name || profile.username}
                </div>
                <div
                  className="text-sm opacity-40"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  @{profile.username}
                </div>
                {profile.city && (
                  <div className="text-xs opacity-50 mt-1">{profile.city}</div>
                )}
                {profile.bio && (
                  <p className="text-sm opacity-70 mt-2 max-w-xs">{profile.bio}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 flex-1">
                <input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Display name"
                  className="w-full text-sm border-b border-black/15 pb-1 focus:outline-none bg-transparent"
                />
                <div className="flex items-center gap-1 border-b border-black/15 pb-1">
                  <span className="text-sm opacity-40" style={{ fontFamily: "'Space Mono', monospace" }}>@</span>
                  <input
                    value={editForm.username}
                    onChange={(e) => setEditForm((f) => ({ ...f, username: normalizeUsername(e.target.value) }))}
                    placeholder="username"
                    className="w-full text-sm focus:outline-none bg-transparent"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  />
                </div>
                <input
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  className="w-full text-sm border-b border-black/15 pb-1 focus:outline-none bg-transparent"
                />
                <div>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((f) => ({ ...f, bio: clampWords(e.target.value, BIO_MAX_WORDS) }))}
                    placeholder="Bio — up to 80 words"
                    rows={3}
                    className="w-full resize-none text-sm bg-transparent focus:outline-none placeholder:opacity-30"
                  />
                  <div className="text-[11px]" style={{ color: wordCount(editForm.bio) >= BIO_MAX_WORDS ? "var(--flame)" : "var(--ink-40)" }}>
                    {wordCount(editForm.bio)}/{BIO_MAX_WORDS} words
                  </div>
                </div>
                <div className="font-label pt-1.5" style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)" }}>Activity &amp; privacy</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.allow_connection_requests}
                    onChange={(e) => setEditForm((f) => ({ ...f, allow_connection_requests: e.target.checked }))}
                    className="accent-orange-600 w-4 h-4" />
                  <span className="text-xs" style={{ color: "var(--ink-60)" }}>Allow others to send me connection requests</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.resonances_private}
                    onChange={(e) => setEditForm((f) => ({ ...f, resonances_private: e.target.checked }))}
                    className="accent-orange-600 w-4 h-4" />
                  <span className="text-xs" style={{ color: "var(--ink-60)" }}>Keep my resonated posts private</span>
                </label>
                {formError && <p className="text-xs text-red-600">{formError}</p>}
              </div>
            )}
          </div>
          {isMe && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs opacity-40 hover:opacity-70"
                  >
                    cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-40"
                    style={{ background: "var(--flame)" }}
                  >
                    {saving ? "saving…" : "save"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs opacity-40 hover:opacity-70"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  settings
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isMe && meId && (
        <ProfileActions
          target={{ id: profile.id, username: profile.username, display_name: profile.display_name, allow_connection_requests: profile.allow_connection_requests }}
          meId={meId}
        />
      )}

      {Object.keys(fp).length > 0 && (
        <div className="rounded-2xl bg-white border border-black/6 px-5 py-4 space-y-3">
          <div
            className="text-xs tracking-widest opacity-40"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            THINKING FINGERPRINT
          </div>
          {Object.entries(AXIS_LABELS).map(([axis, [left, right]]) => {
            const val = typeof fp[axis] === "number" ? (fp[axis] as number) : 0.5;
            const pct = Math.round(val * 100);
            return (
              <div key={axis} className="space-y-1">
                <div className="flex justify-between text-xs opacity-40">
                  <span>{left}</span>
                  <span>{right}</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/8 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "var(--flame)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <div className="flex gap-2 mb-3">
          {(["posts", "resonated"] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors"
              style={tab === tb
                ? { background: "var(--flame)", color: "#fff" }
                : { background: "var(--paper)", color: "var(--ink-60)", border: "1px solid var(--line)" }}>
              {tb === "posts" ? "Posts" : "Resonated"}
            </button>
          ))}
        </div>

        {tab === "posts" ? (
          thoughts.length === 0 ? (
            <div className="text-center py-8 opacity-30 text-sm">No thoughts yet.</div>
          ) : (
            <div className="space-y-3">
              {thoughts.map((t) => (
                <ThoughtCard key={t.id} thought={t} canManage={isMe} onChanged={load} />
              ))}
            </div>
          )
        ) : !isMe && profile.resonances_private ? (
          <div className="text-center py-8 opacity-40 text-sm">@{profile.username} keeps their resonated posts private.</div>
        ) : loadingReson || resonatedThoughts === null ? (
          <div className="h-24 rounded-2xl skeleton" />
        ) : resonatedThoughts.length === 0 ? (
          <div className="text-center py-8 opacity-30 text-sm">{isMe ? "You haven't resonated with anything yet." : "Nothing resonated yet."}</div>
        ) : (
          <div className="space-y-3">
            {resonatedThoughts.map((t) => (
              <ThoughtCard key={t.id} thought={t} />
            ))}
          </div>
        )}
      </div>

      {isMe && (
        <button
          onClick={signOut}
          className="w-full mt-2 py-3 rounded-2xl text-sm font-semibold transition-colors"
          style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}
        >
          Sign out
        </button>
      )}
    </div>
  );
}

