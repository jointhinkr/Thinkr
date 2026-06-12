"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SAMPLE_MS = 15000; // how often the host's client sends a frame for AI screen moderation

// The video stage for a livestream room (live_rooms.is_stream = true).
// Host: captures camera, self-view, periodic frame moderation, end control.
// Viewer: live indicator + report (report immediately revokes host privileges).
// NOTE: viewer video delivery needs a streaming provider (LiveKit/Mux/Agora) —
// the host preview + chat + moderation work today; wire a provider for fan-out.
export default function LivestreamStage({
  roomId, hostId, meId, hostName,
}: {
  roomId: string;
  hostId: string;
  meId: string | null;
  hostName: string;
}) {
  const router = useRouter();
  const isHost = !!meId && meId === hostId;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"idle" | "live" | "ended" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [endedMsg, setEndedMsg] = useState("");
  const [confirmReport, setConfirmReport] = useState(false);
  const [reporting, setReporting] = useState(false);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (!isHost) { setStatus("live"); return; }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function sampleFrame() {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
      const w = 320;
      const h = Math.round((v.videoHeight / v.videoWidth) * w) || 240;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      const image = canvas.toDataURL("image/jpeg", 0.5);
      try {
        const res = await fetch("/api/moderate-stream", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ streamId: roomId, image }),
        });
        const data = await res.json();
        if (data?.ended) {
          stopCam();
          if (interval) clearInterval(interval);
          setEndedMsg(data.reason || "Your stream was ended by automated moderation, and your livestream access was revoked.");
          setStatus("ended");
        }
      } catch { /* network blip — keep streaming, next sample retries */ }
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("live");
        interval = setInterval(sampleFrame, SAMPLE_MS);
      } catch {
        setStatus("error");
        setErrMsg("Camera and microphone access is required to go live. Enable access and reopen the room.");
      }
    })();

    return () => { cancelled = true; if (interval) clearInterval(interval); stopCam(); };
  }, [isHost, roomId]);

  async function endStream() {
    stopCam();
    const supabase = createClient();
    await supabase.from("live_rooms").update({ is_live: false }).eq("id", roomId);
    router.push("/ignite");
  }

  async function reportStream() {
    if (!meId || reporting) return;
    setReporting(true);
    const supabase = createClient();
    // Audit trail + immediate revocation (strong moderation by design).
    await supabase.from("reports").insert({ reporter_id: meId, reported_id: hostId, reason: "Livestream reported by a viewer." });
    await supabase.rpc("revoke_livestream", { host: hostId });
    setReporting(false);
    setEndedMsg("You reported this stream. It has been ended and the host's livestream access revoked.");
    setStatus("ended");
  }

  if (status === "ended") {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "#1c140b", color: "#fff" }}>
        <div className="text-2xl mb-2">⏹️</div>
        <div className="font-display text-lg">Stream ended</div>
        <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>{endedMsg || "This livestream is over."}</p>
        <button onClick={() => router.push("/ignite")} className="mt-4 px-5 py-2.5 rounded-full text-sm font-semibold" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
          Back to Ignite
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden relative" style={{ background: "#1c140b", aspectRatio: "16 / 10" }}>
      {/* LIVE badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(244,74,38,0.9)" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff", animation: "pulse-dot 1.2s infinite" }} />
        <span className="font-label text-white" style={{ fontSize: "9px", letterSpacing: "0.1em" }}>LIVE</span>
      </div>

      {isHost ? (
        <>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {status === "error" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center" style={{ background: "rgba(28,20,11,0.85)" }}>
              <p className="text-sm" style={{ color: "#fff" }}>{errMsg}</p>
            </div>
          )}
          <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between">
            <span className="font-label text-white px-2 py-1 rounded-full" style={{ fontSize: "9px", background: "rgba(0,0,0,0.4)" }}>
              📹 You&apos;re live · screen + chat are moderated
            </span>
            <button onClick={endStream} className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
              End stream
            </button>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <div className="w-16 h-16 rounded-full mx-auto grid place-items-center text-2xl font-bold text-white mb-3" style={{ background: "linear-gradient(135deg, var(--flame), var(--amber))" }}>
              {hostName.charAt(0).toUpperCase()}
            </div>
            <div className="text-white font-display text-lg">{hostName} is live</div>
            <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.55)", maxWidth: 280 }}>
              Live video appears here once a streaming provider is connected. Chat below is live and moderated.
            </p>
            {!confirmReport ? (
              <button onClick={() => setConfirmReport(true)} className="mt-4 px-4 py-2 rounded-full text-xs font-semibold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
                Report stream
              </button>
            ) : (
              <button onClick={reportStream} disabled={reporting} className="mt-4 px-4 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#dc2626" }}>
                {reporting ? "Reporting…" : "Tap to confirm — ends stream"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
