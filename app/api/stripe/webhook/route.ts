import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe webhook — the SINGLE source of truth for granting paid entitlements.
// Access is NEVER granted from the client success redirect. We verify the
// signature, then apply the grant through grant_from_stripe(), which records the
// event id + applies the change in one transaction (idempotent: a replayed event
// no-ops).
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "webhook not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    return new NextResponse(`Webhook signature verification failed: ${e instanceof Error ? e.message : ""}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const kind = session.metadata?.kind;
    const tries = parseInt(session.metadata?.tries ?? "0", 10) || 0;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey && userId && kind) {
      const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });
      const { error } = await admin.rpc("grant_from_stripe", {
        event_id: event.id, event_type: event.type, target: userId, kind, tries,
      });
      if (error) {
        // Return 500 so Stripe retries (idempotency makes retries safe).
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
