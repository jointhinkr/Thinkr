import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// On-screen livestream moderation. The host's client samples frames and POSTs
// them here; Claude vision rates the frame and, on a severe violation, ends the
// stream and revokes the host's livestream privileges.
//
// Note: client-side frame sampling is the only option without a media server.
// A determined host could withhold frames — report-driven revocation is the
// human backstop, and true server-side enforcement needs a streaming provider.
//
// Requires SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY; no-ops safely without.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are a livestream safety classifier for Thinkr, an 18+ social app (some approved under-18 testers also use it). You receive a single frame from a user's live video. Decide if it shows content that violates policy: nudity or sexual content, graphic violence or gore, weapons brandished threateningly, or other clearly unsafe/illegal content.

Return ONLY JSON: {"violation": true|false, "severity":"none|low|medium|high|severe", "reason":"<=200 chars"}.
Use "severe" only for explicit nudity/sexual content, graphic violence, or anything endangering a minor. Ordinary faces, rooms, and everyday scenes are "none".`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const streamId = body?.streamId as string | undefined;
  const image = body?.image as string | undefined;
  if (!streamId || !image) return NextResponse.json({ ok: false, error: "missing streamId/image" }, { status: 400 });

  const supa = await createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !serviceKey || !anthropicKey) {
    return NextResponse.json({ ok: true, assessed: false, reason: "stream moderation not configured" });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: room } = await admin.from("live_rooms").select("host_id, is_live, is_stream").eq("id", streamId).single();
  if (!room || room.host_id !== user.id || !room.is_stream) {
    return NextResponse.json({ ok: false, error: "not your stream" }, { status: 403 });
  }
  if (!room.is_live) return NextResponse.json({ ok: true, ended: true });

  const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return NextResponse.json({ ok: false, error: "bad image" }, { status: 400 });
  const mediaType = m[1];
  const b64 = m[2];

  let violation = false;
  let severity = "none";
  let reason = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
            { type: "text", text: "Assess this livestream frame." },
          ],
        }],
      }),
    });
    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const mm = text.match(/\{[\s\S]*\}/);
    if (mm) {
      const parsed = JSON.parse(mm[0]);
      violation = !!parsed.violation;
      if (parsed.severity) severity = String(parsed.severity);
      if (parsed.reason) reason = String(parsed.reason).slice(0, 200);
    }
  } catch {
    return NextResponse.json({ ok: true, ended: false, error: "assessment failed" });
  }

  if (violation && severity === "severe") {
    await admin.from("profiles").update({ livestream_revoked: true }).eq("id", room.host_id);
    await admin.from("live_rooms").update({ is_live: false }).eq("id", streamId);
    return NextResponse.json({ ok: true, ended: true, reason });
  }
  return NextResponse.json({ ok: true, ended: false, severity });
}
