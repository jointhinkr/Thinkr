import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// AI Trust & Safety assessment of a user report.
// Flow: client files a report (RLS-protected), then POSTs the reportId here.
// We read the report + reported content with the service role, ask Claude to
// rate the threat, record the verdict, and AUTO-SUSPEND (reversible) only on a
// severe, unambiguous verdict. Everything else is flagged for human review.
//
// Required server env to assess: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
// Without them, the report is left for manual review and this route no-ops safely.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are a Trust & Safety moderation assistant for Thinkr, an 18+ connection-first social app (a small number of approved under-18 beta testers also use it). Given a user report and the reported user's content, assess the threat level.

Thinkr strictly prohibits anywhere on the platform: credible threats or incitement of violence; harassment, bullying, or hate speech; content that promotes or encourages self-harm or suicide or that endangers others; sexual or explicit content (Thinkr is not a dating app); sexual content involving minors; doxxing; and illegal activity.

Return ONLY a JSON object, no prose:
{"severity":"none|low|medium|high|severe","action":"none|flag|suspend","rationale":"<=400 chars explaining the call"}

Rules:
- Use "suspend" ONLY for severe, unambiguous violations: credible threats of violence, sexual content involving minors, sustained targeted harassment, doxxing, or clear incitement.
- When uncertain or when content is merely rude/disagreeable, prefer "flag" for human review — never "suspend".
- Reported content that does not actually violate policy should be "none"/"none".`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const reportId = body?.reportId as string | undefined;
  if (!reportId) return NextResponse.json({ ok: false, error: "missing reportId" }, { status: 400 });

  // Caller must be the authenticated reporter.
  const supa = await createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Privileged work needs the service role; degrade gracefully to manual review.
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: true, assessed: false, reason: "moderation not configured (no service role)" });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: report } = await admin.from("reports").select("*").eq("id", reportId).single();
  if (!report || report.reporter_id !== user.id) {
    return NextResponse.json({ ok: false, error: "report not found" }, { status: 404 });
  }
  if (report.ai_checked_at) {
    return NextResponse.json({ ok: true, assessed: true, already: true });
  }

  const { data: reported } = await admin
    .from("profiles").select("id, suspended").eq("id", report.reported_id).single();

  let reportedPost = "";
  if (report.thought_id) {
    const { data: th } = await admin.from("thoughts").select("body").eq("id", report.thought_id).single();
    reportedPost = th?.body ?? "";
  }
  const { data: recent } = await admin
    .from("thoughts").select("body").eq("author_id", report.reported_id)
    .order("created_at", { ascending: false }).limit(10);

  const now = new Date().toISOString();

  // No AI key → flag for human review.
  if (!anthropicKey) {
    await admin.from("reports").update({
      ai_action: "flag",
      ai_rationale: "AI assessment not configured — queued for manual review.",
      ai_checked_at: now,
      status: "reviewed",
    }).eq("id", reportId);
    return NextResponse.json({ ok: true, assessed: false, reason: "no AI key — flagged for manual review" });
  }

  const userMessage = `REPORT REASON:\n${report.reason}\n\nREPORTED POST (if any):\n${reportedPost || "(none provided)"}\n\nREPORTED USER'S RECENT POSTS:\n${(recent ?? []).map((r, i) => `${i + 1}. ${r.body}`).join("\n") || "(none)"}`;

  let severity = "none";
  let action = "flag";
  let rationale = "Assessment unavailable; flagged for human review.";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.severity) severity = String(parsed.severity);
      if (parsed.action) action = String(parsed.action);
      if (parsed.rationale) rationale = String(parsed.rationale).slice(0, 400);
    }
  } catch {
    rationale = "AI call failed; flagged for human review.";
  }

  const suspend = action === "suspend" && severity === "severe";
  await admin.from("reports").update({
    ai_severity: severity,
    ai_action: suspend ? "suspend" : "flag",
    ai_rationale: rationale,
    ai_checked_at: now,
    status: suspend ? "actioned" : "reviewed",
  }).eq("id", reportId);

  if (suspend && reported && !reported.suspended) {
    await admin.from("profiles").update({
      suspended: true,
      suspended_at: now,
      suspended_reason: `Auto-suspended after report assessment: ${rationale}`.slice(0, 500),
    }).eq("id", report.reported_id);
  }

  return NextResponse.json({ ok: true, assessed: true, severity, action: suspend ? "suspend" : "flag" });
}
