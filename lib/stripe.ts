import Stripe from "stripe";

// Server-only Stripe client. Lazily constructed so a missing key fails at the
// route (with a clear message) rather than at module load / build time.
// Use TEST keys (sk_test_…) until you're ready for real charges.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key);
  return _stripe;
}

export const VIDEO_ACCESS_PRICE_CENTS = 2500; // $25 one-time
