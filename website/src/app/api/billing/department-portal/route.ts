/**
 * POST /api/billing/department-portal
 *
 * Creates a Stripe Customer Portal session scoped to the calling
 * institution's Stripe customer (institutional_accounts.stripe_customer_id).
 * Institutional admins use this to update payment method, view invoices,
 * change billing email, or cancel the Department subscription — all
 * inside the Stripe-hosted portal UI.
 *
 * Distinct from /api/billing/portal, which opens the portal for an
 * individual user's stripe_customer_id (Individual Pro).
 *
 * Auth: requireInstitutionalAdmin — same gate the rest of /api/team/*
 * and /api/billing/department-upgrade use.
 *
 * Tier-change attempts inside the portal still flow through our normal
 * subscription.updated webhook, which re-derives seats_allocated. The
 * portal itself does not bypass our seat-cap safety guards because we
 * only enable the Department products in the portal configuration; for
 * Small ↔ Large swaps users should prefer the on-site /team buttons
 * which enforce the downgrade-safety check (refuse if seats_used > 10).
 */

import { NextResponse } from "next/server";
import { requireInstitutionalAdmin } from "@/lib/team";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  const account = gate.account;
  if (!account.stripe_customer_id) {
    return NextResponse.json(
      {
        error:
          "This institution has no Stripe customer record. If you were provisioned manually by sales, contact support to manage billing.",
      },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  const returnUrl =
    process.env.STRIPE_DEPARTMENT_PORTAL_RETURN_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/team`;

  const portal = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portal.url });
}
