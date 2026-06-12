"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ConnState = "none" | "sent" | "incoming" | "connected";

// Social + safety actions for ANOTHER user's profile:
//   Muse (one-way follow)  ·  Connection (mutual, unlocks messaging)  ·  Report  ·  Block
export default function ProfileActions({
  target,
  meId,
}: {
  target: { id: string; username: string; display_name: string | null; allow_connection_requests?: boolean | null };
  meId: string;
}) {
  const router = useRouter();
  const [musing, setMusing] = useState(false);
  const [conn, setConn] = useState<ConnState>("none");
  const [reqId, setReqId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const acceptsRequests = target.allow_connection_requests !== false;

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: muse }, { data: req }, { data: block }] = await Promise.all([
        supabase.from("muses").select("muser_id").eq("muser_id", meId).eq("muse_id", target.id).maybeSingle(),
        supabase.from("connection_requests").select("id, requester_id, status")
          .or(`and(requester_id.eq.${meId},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${meId})`)
          .maybeSingle(),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", meId).eq("blocked_id", target.id).maybeSingle(),
      ]);
      setMusing(!!muse);
      setBlocked(!!block);
      if (req) {
        setReqId(req.id);
        if (req.status === "accepted") setConn("connected");
        else if (req.status === "pending") setConn(req.requester_id === meId ? "sent" : "incoming");
      }
      setLoaded(true);
    })();
  }, [meId, target.id]);

  async function toggleMuse() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    if (musing) {
      await supabase.from("muses").delete().eq("muser_id", meId).eq("muse_id", target.id);
      setMusing(false);
    } else {
      const { error } = await supabase.from("muses").insert({ muser_id: meId, muse_id: target.id });
      if (!error) setMusing(true);
    }
    setBusy(false);
  }

  async function requestConnect() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("connection_requests").insert({ requester_id: meId, addressee_id: target.id });
    if (!error) setConn("sent");
    setBusy(false);
  }

  async function approveConnect() {
    if (busy || !reqId) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("respond_to_connection", { req: reqId, accept: true });
    setConn("connected");
    setBusy(false);
  }

  async function openChat() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("start_direct_conversation", { other: target.id });
    setBusy(false);
    if (data) router.push(`/echo/${data}`);
  }

  async function submitReport() {
    if (reporting || reportReason.trim().length < 3) return;
    setReporting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("reports")
      .insert({ reporter_id: meId, reported_id: target.id, reason: reportReason.trim() })
      .select("id")
      .single();
    if (!error && data) {
      // Fire-and-forget AI assessment; the report is already safely stored.
      fetch("/api/moderate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId: data.id }),
      }).catch(() => {});
      setReportSent(true);
    }
    setReporting(false);
  }

  async function doBlock() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("block_user", { target: target.id });
    setBlocked(true);
    setMusing(false);
    setConn("none");
    setConfirmBlock(false);
    setBusy(false);
  }

  async function unblock() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("blocks").delete().eq("blocker_id", meId).eq("blocked_id", target.id);
    setBlocked(false);
    setBusy(false);
  }

  if (!loaded) return <div className="h-10 rounded-full skeleton" />;

  if (blocked) {
    return (
      <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
        <span className="text-sm" style={{ color: "var(--ink-60)" }}>You blocked @{target.username}.</span>
        <button onClick={unblock} disabled={busy} className="text-sm font-semibold disabled:opacity-50" style={{ color: "var(--flame)" }}>Unblock</button>
      </div>
    );
  }

  const flameBtn = { background: "linear-gradient(135deg, var(--flame), var(--flame-deep))", boxShadow: "var(--shadow-flame)" };

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2.5">
        {/* Muse = one-way follow */}
        <button onClick={toggleMuse} disabled={busy}
          className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
          style={musing
            ? { border: "1.5px solid var(--flame)", color: "var(--flame)", background: "#FFF6EC" }
            : { border: "1.5px solid var(--line-2)", color: "var(--ink-1)" }}>
          {musing ? "✦ Musing" : "✦ Muse"}
        </button>

        {/* Connection = mutual, unlocks messaging */}
        {conn === "connected" ? (
          <button onClick={openChat} disabled={busy} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={flameBtn}>
            Message →
          </button>
        ) : conn === "incoming" ? (
          <button onClick={approveConnect} disabled={busy} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={flameBtn}>
            Approve connection
          </button>
        ) : conn === "sent" ? (
          <button disabled className="flex-1 py-2.5 rounded-full text-sm font-semibold opacity-70" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>
            Request sent ✓
          </button>
        ) : acceptsRequests ? (
          <button onClick={requestConnect} disabled={busy} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={flameBtn}>
            Request to connect
          </button>
        ) : (
          <button disabled className="flex-1 py-2.5 rounded-full text-xs font-semibold opacity-70" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-40)" }}>
            Not accepting requests
          </button>
        )}
      </div>

      <p className="text-[11px] text-center" style={{ color: "var(--ink-40)" }}>
        Muse to follow their thoughts. Connect (mutual) to message.
      </p>

      <div className="flex items-center justify-center gap-4 pt-0.5">
        <button onClick={() => { setReportOpen(true); setReportSent(false); }} className="text-xs" style={{ color: "var(--ink-40)" }}>Report</button>
        <span style={{ color: "var(--line-2)" }}>·</span>
        {!confirmBlock ? (
          <button onClick={() => setConfirmBlock(true)} className="text-xs" style={{ color: "var(--ink-40)" }}>Block</button>
        ) : (
          <button onClick={doBlock} disabled={busy} className="text-xs font-semibold disabled:opacity-50" style={{ color: "#dc2626" }}>Tap to confirm block</button>
        )}
      </div>

      {/* Report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(28,20,11,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-[420px] rounded-[22px] p-6" style={{ background: "var(--paper)", boxShadow: "var(--shadow-lg)" }}>
            {!reportSent ? (
              <>
                <h3 className="font-display text-[22px]" style={{ fontWeight: 600, color: "var(--ink-1)" }}>Report @{target.username}</h3>
                <p className="text-[13px] mt-1.5" style={{ color: "var(--ink-60)" }}>
                  Tell us what&apos;s wrong. Our safety system reviews every report and may suspend accounts for serious violations.
                </p>
                <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={4} maxLength={1000}
                  placeholder="Describe the threat, harassment, explicit content, or other violation…"
                  className="w-full mt-3 rounded-xl px-3.5 py-3 text-sm resize-none focus:outline-none"
                  style={{ background: "#fff", border: "1.5px solid var(--line)", color: "var(--ink-1)" }} />
                <div className="flex gap-2.5 mt-4">
                  <button onClick={() => setReportOpen(false)} className="px-4 py-2.5 rounded-full text-sm font-semibold" style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-60)" }}>Cancel</button>
                  <button onClick={submitReport} disabled={reporting || reportReason.trim().length < 3}
                    className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40" style={flameBtn}>
                    {reporting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl mb-2">🛡️</div>
                <h3 className="font-display text-[22px]" style={{ fontWeight: 600, color: "var(--ink-1)" }}>Report submitted</h3>
                <p className="text-[14px] mt-2" style={{ color: "var(--ink-60)", lineHeight: 1.55 }}>
                  Thank you. Our safety system is reviewing this now and will act if a violation is found. Consider blocking
                  @{target.username} if you don&apos;t want to see them.
                </p>
                <button onClick={() => setReportOpen(false)} className="mt-5 w-full py-3 rounded-full text-sm font-semibold text-white" style={flameBtn}>Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
