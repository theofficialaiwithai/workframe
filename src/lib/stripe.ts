import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  throw new Error(
    "STRIPE_SECRET_KEY is missing. Add it to .env.local (test mode: sk_test_...) or to the Vercel project's environment variables."
  );
}

/** Configured Stripe client. Server-side only; the key never reaches the browser. */
export const stripe = new Stripe(key);
