/**
 * Stripe client singleton. Reads STRIPE_SECRET_KEY from env at first
 * use. Test-mode and live-mode share this client — the key value
 * determines which Stripe environment we're hitting.
 *
 * Throwing on missing key at first call (rather than at import time)
 * keeps the build process unaware of secrets.
 */

import Stripe from "stripe";
import { TIERS, type TierId } from "./tiers";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Billing endpoints require Stripe configuration.");
  }
  _stripe = new Stripe(key, {
    // Pin API version so dashboard updates can't silently break us.
    apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    typescript: true,
  });
  return _stripe;
}

/**
 * Map a Stripe price ID back to the tier it represents. Used by the
 * webhook handler to translate subscription events into our tier
 * vocabulary. Currently only Individual Pro has Stripe price IDs;
 * Department/Hospital are sales-driven and assigned manually.
 */
export function tierForPriceId(priceId: string | null | undefined): TierId | null {
  if (!priceId) return null;
  if (
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_ANNUAL
  ) {
    return "individual_pro";
  }
  if (
    priceId === process.env.STRIPE_PRICE_DEPARTMENT_SMALL ||
    priceId === process.env.STRIPE_PRICE_DEPARTMENT_LARGE
  ) {
    return "department";
  }
  return null;
}

/** Resolve the Department SKU price ID from the requested seat count. */
export function departmentPriceIdForSeats(seats: number): string | undefined {
  if (seats <= 10) return process.env.STRIPE_PRICE_DEPARTMENT_SMALL;
  return process.env.STRIPE_PRICE_DEPARTMENT_LARGE;
}

/**
 * Inverse mapping: given a Department price ID, how many seats does it
 * allocate? Used by the webhook to re-derive seats_allocated whenever a
 * subscription changes price (Small ↔ Large).
 */
export function seatsForDepartmentPriceId(priceId: string | null | undefined): number | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_DEPARTMENT_SMALL) return 10;
  if (priceId === process.env.STRIPE_PRICE_DEPARTMENT_LARGE) return 20;
  return null;
}

/**
 * Translate a Stripe subscription status into our local
 * subscription_status column convention. We only treat "active",
 * "trialing", and "past_due" as access-granting; everything else
 * downgrades the user to free at the gate.
 */
export type LocalSubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";

export function localStatusFromStripe(status: Stripe.Subscription.Status): LocalSubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "unpaid":
      return status;
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "past_due";
    default:
      return "canceled";
  }
}

/** Subscription is in a state where Pro features should be granted. */
export function isAccessGrantingStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/**
 * Friendly display name for the price ID — used in receipts and the
 * settings billing tab. Falls back to TIER name for unknown prices.
 */
export function describePrice(priceId: string | null | undefined): string {
  if (!priceId) return "—";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    return `${TIERS.individual_pro.name} · monthly`;
  }
  if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
    return `${TIERS.individual_pro.name} · annual`;
  }
  if (priceId === process.env.STRIPE_PRICE_DEPARTMENT_SMALL) {
    return `${TIERS.department.name} · up to 10 seats`;
  }
  if (priceId === process.env.STRIPE_PRICE_DEPARTMENT_LARGE) {
    return `${TIERS.department.name} · up to 20 seats`;
  }
  return "Subscription";
}
