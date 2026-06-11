"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThoughtCard from "@/components/thought-card";
import Avatar from "@/components/avatar";
import { uploadToBucket } from "@/lib/upload";
import type { Profile, ThoughtWithMeta } from "@/lib/types";

const AXIS_LABELS: Record<string, [string, string]> = {
  abstract_vs_concrete: ["Abstract", "Concrete"],
  optimist_vs_skeptic: ["Optimist", "Skeptic"],
  builder_vs_critic: ["Builder", "Critic"],
  solo_vs_social: ["Solo", "Social"],
  novelty_vs_depth: ["Novelty", "Depth"],
};

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [thoughts, setThoughts] = useState<ThoughtWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMe, setIsMe] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: "", bio: "", city: "" });
  const [saving, setSaving] = useState(false);
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
    setIsMe(user?.id === p.id);
    setEditForm({
      display_name: p.display_name ?? "",
      bio: p.bio ?? "",
      city: p.city ?? "",
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

    setThoughts(
      rows.map((r) => ({
        ...r,
        author: r.author,
        resonated: resonatedSet.has(r.id),
        branch_count: 0,
      }))
    );
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editForm.display_name || null,
        bio: editForm.bio || null,
        city: editForm.city || null,
      })
      .eq("id", profile.id);
    if (!error) {
      setEditing(false);
      load();
    }
    setSaving(false);
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
              <div className="space-y-2 flex-1">
                <input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Display name"
                  className="w-full text-sm border-b border-black/15 pb-1 focus:outline-none bg-transparent"
                />
                <input
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  className="w-full text-sm border-b border-black/15 pb-1 focus:outline-none bg-transparent"
                />
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Bio"
                  maxLength={300}
                  rows={2}
                  className="w-full resize-none text-sm bg-transparent focus:outline-none placeholder:opacity-30"
                />
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
                  edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
        <div
          className="text-xs tracking-widest opacity-40 mb-3"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          THOUGHTS
        </div>
        {thoughts.length === 0 ? (
          <div className="text-center py-8 opacity-30 text-sm">No thoughts yet.</div>
        ) : (
          <div className="space-y-3">
            {thoughts.map((t) => (
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

