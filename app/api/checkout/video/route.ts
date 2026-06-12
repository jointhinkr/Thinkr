import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, VIDEO_ACCESS_PRICE_CENTS } from "@/lib/stripe";

export const runtime = "nodejs";

// Starts a $25 one-time Stripe Checkout for video access. The user's id goes in
// metadata so the webhook (the ONLY place access is granted) knows who paid.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Already entitled? Don't charge again.
  const { data: profile } = await supabase
    .from("profiles").select("has_video_access, role").eq("id", user.id).single();
  if (profile?.has_video_access || profile?.role === "premium" || profile?.role === "admin") {
    return NextResponse.json({ error: "already has video access" }, { status: 400 });
  }

  let stripe;
  try { stripe = getStripe(); }
  catch { return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 }); }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://thinkr.social";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: VIDEO_ACCESS_PRICE_CENTS,
          product_data: { name: "Thinkr+ Video Access", description: "One-time unlock for camera livestreaming" },
        },
      }],
      metadata: { user_id: user.id, kind: "video" },
      success_url: `${origin}/ignite?video=success`,
      cancel_url: `${origin}/ignite?video=cancel`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 500 });
  }
}
