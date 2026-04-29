/**
 * POST /api/billing/checkout
 * Body: { plan: "monthly" | "annual" }
 *
 * Creates a Stripe Checkout session for the Individual Pro plan with a
 * 14-day trial. Card collection is required upfront — Stripe will
 * authorize the payment method but not charge until the trial ends.
 *
 * Returns { url } on success — the client should redirect to it. The
 * checkout flow handles signup, payment method capture, trial start,
 * and subscription creation; the webhook then sets the user's tier in
 * our DB.
 *
 * Requires an authenticated session. The Stripe customer is created
 * lazily on first checkout and persisted to users.stripe_customer_id.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  findUserByLogin,
  setStripeCustomerId,
} from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const TRIAL_DAYS = 14;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { plan?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const plan = body.plan;
  let priceId: string | undefined;
  if (plan === "monthly") priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
  else if (plan === "annual") priceId = process.env.STRIPE_PRICE_PRO_ANNUAL;
  else return NextResponse.json({ error: "plan must be 'monthly' or 'annual'." }, { status: 400 });

  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_PRO_${plan.toUpperCase()} env var is not configured.` },
      { status: 500 },
    );
  }

  const dbUser = findUserByLogin(email);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Create or reuse the Stripe customer
  let customerId = dbUser.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser.email,
      name: dbUser.full_name ?? undefined,
      metadata: {
        user_id: String(dbUser.id),
        username: dbUser.username,
      },
    });
    customerId = customer.id;
    setStripeCustomerId(dbUser.id, customerId);
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        user_id: String(dbUser.id),
      },
    },
    // Card required upfront; Stripe charges after the trial.
    payment_method_collection: "always",
    success_url: `${baseUrl}/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/settings/billing?checkout=cancelled`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
    billing_address_collection: "auto",
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
