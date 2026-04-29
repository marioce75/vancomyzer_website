/**
 * POST /api/billing/webhook
 *
 * Stripe webhook receiver. Verifies the request signature, then
 * translates subscription lifecycle events into local DB updates so
 * the user's tier / status / expiry stay in lockstep with Stripe.
 *
 * Local subscription_status convention (set in lib/stripe.ts):
 *   active | trialing | past_due | canceled | incomplete | unpaid
 *
 * Events handled:
 *   customer.subscription.created   → grant tier, set trial expiry
 *   customer.subscription.updated   → re-sync tier/status/expiry
 *   customer.subscription.deleted   → revert to free, clear sub IDs
 *   invoice.payment_failed          → status=past_due (still grants access; user gets a few retries)
 *
 * Required env: STRIPE_WEBHOOK_SECRET (the `whsec_...` value Stripe
 * gives you when you register the webhook). The Stripe CLI dev workflow:
 *   stripe listen --forward-to localhost:3000/api/billing/webhook
 *   → copy the displayed `whsec_...` into .env.local
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  tierForPriceId,
  localStatusFromStripe,
} from "@/lib/stripe";
import {
  applySubscriptionUpdate,
  findUserByStripeCustomerId,
  findUserByStripeSubscriptionId,
  logSecurityEvent,
} from "@/lib/db";

// Stripe's signed payload must be read as the raw body — Next.js gives
// us that via req.text(). Do NOT use req.json() here.
export const dynamic = "force-dynamic";

function expiryFromSubscription(sub: Stripe.Subscription): string | null {
  // Prefer trial_end while the subscription is in trial; otherwise the
  // current paid period boundary. Both are unix seconds.
  const ts = sub.trial_end ?? sub.current_period_end;
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function handleSubscriptionEvent(sub: Stripe.Subscription) {
  // Resolve the user. Prefer subscription metadata.user_id (set at
  // checkout); fall back to customer lookup.
  const metaUserId = sub.metadata?.user_id;
  let user = metaUserId ? findUserByStripeSubscriptionId(sub.id) : undefined;
  if (!user && typeof sub.customer === "string") {
    user = findUserByStripeCustomerId(sub.customer);
  }
  if (!user) {
    console.warn(
      `[stripe-webhook] subscription ${sub.id} has no matching local user (customer=${sub.customer}). Ignoring.`,
    );
    return;
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const tier = tierForPriceId(priceId) ?? "free";
  const status = localStatusFromStripe(sub.status);

  applySubscriptionUpdate(user.id, {
    tier: status === "canceled" ? "free" : tier,
    status,
    expiry: expiryFromSubscription(sub),
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
  });

  logSecurityEvent({
    user_id: user.id,
    username: user.username,
    action: "SUBSCRIPTION_UPDATED",
    details: JSON.stringify({
      stripe_subscription_id: sub.id,
      tier,
      status,
      price_id: priceId,
    }),
    severity: "info",
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const user = findUserByStripeSubscriptionId(sub.id);
  if (!user) return;
  applySubscriptionUpdate(user.id, {
    tier: "free",
    status: "canceled",
    expiry: null,
    // Keep customer_id for future re-subscribes; clear subscription IDs.
    stripeSubscriptionId: null,
    stripePriceId: null,
  });
  logSecurityEvent({
    user_id: user.id,
    username: user.username,
    action: "SUBSCRIPTION_CANCELED",
    details: JSON.stringify({ stripe_subscription_id: sub.id }),
    severity: "info",
  });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured. Cannot verify webhook.");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[stripe-webhook] signature verification failed: ${message}`);
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const user = findUserByStripeSubscriptionId(subId);
          if (user) {
            applySubscriptionUpdate(user.id, {
              tier: user.subscription_tier,
              status: "past_due",
              expiry: user.subscription_expiry,
              stripeSubscriptionId: subId,
              stripePriceId: user.stripe_price_id,
            });
            logSecurityEvent({
              user_id: user.id,
              username: user.username,
              action: "SUBSCRIPTION_PAYMENT_FAILED",
              details: JSON.stringify({ invoice_id: invoice.id, subscription_id: subId }),
              severity: "warn",
            });
          }
        }
        break;
      }

      default:
        // Many event types we deliberately ignore (charge.*, payment_intent.*, etc.)
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
