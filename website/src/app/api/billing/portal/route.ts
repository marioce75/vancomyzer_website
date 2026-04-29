/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription — update payment method, switch plans, cancel,
 * download invoices. Stripe owns the entire UI; we just hand off.
 *
 * Requires an authenticated session and an existing stripe_customer_id
 * (i.e. the user must have completed checkout at least once).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserByLogin } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const dbUser = findUserByLogin(email);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (!dbUser.stripe_customer_id) {
    return NextResponse.json(
      { error: "No active subscription. Start a trial first." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const returnUrl =
    process.env.STRIPE_PORTAL_RETURN_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings/billing`;

  const portal = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripe_customer_id,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portal.url });
}
