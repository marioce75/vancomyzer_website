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
  seatsForDepartmentPriceId,
} from "@/lib/stripe";
import {
  applySubscriptionUpdate,
  findUserByStripeCustomerId,
  findUserByStripeSubscriptionId,
  findUserByLogin,
  findUserByEmail,
  findUserById,
  findInstitutionByStripeCustomerId,
  findInstitutionByStripeSubscriptionId,
  createInstitutionalAccount,
  setInstitutionStripeCustomer,
  applyInstitutionSubscriptionUpdate,
  setInstitutionSeatsAllocated,
  setUserInstitution,
  setUserTier,
  recountSeats,
  logSecurityEvent,
  findUnconvertedReferralForReferred,
  markReferralConverted,
  markReferralCreditApplied,
} from "@/lib/db";
import { sendDepartmentWelcomeEmail, sendReferralConvertedEmail } from "@/lib/email";
import { issueMagicLinkToken } from "@/lib/magicLink";

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
  // Branch: Department (institution-owned) subscriptions go through their
  // own provisioning flow. Detected via metadata.kind === "department"
  // set at checkout.
  if (sub.metadata?.kind === "department") {
    return handleDepartmentSubscriptionEvent(sub);
  }

  // Default: Individual Pro (user-owned). Resolve the user via
  // subscription.id first, then customer.id as fallback.
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

  // Referral conversion: if this user was referred and just became active
  // (i.e., transitioned from trial to paid), fire a 1-month credit to the
  // referrer's Stripe customer balance and notify them by email. Idempotent
  // via converted_at IS NULL guard in findUnconvertedReferralForReferred.
  if (status === "active") {
    await fireReferralCreditIfApplicable(user).catch((err) => {
      console.error(`[referral] Credit issuance failed for user ${user.id}:`, err);
    });
  }
}

// Single month of Individual Pro at the current public price. Hardcoded
// because the referrer's plan may be free, in which case we still owe them
// one month of Pro value as a credit usable when they upgrade.
const REFERRAL_CREDIT_CENTS = 999;

async function fireReferralCreditIfApplicable(referredUser: { id: number; email: string }) {
  const referral = findUnconvertedReferralForReferred(referredUser.id);
  if (!referral) return;

  const referrer = findUserById(referral.referrer_user_id);
  if (!referrer) {
    console.warn(`[referral] Referrer ${referral.referrer_user_id} not found for referral ${referral.id}`);
    return;
  }

  // Mark converted regardless of whether we can immediately issue the credit
  // (e.g., referrer has no Stripe customer yet). Stats still reflect the
  // conversion; the unapplied credit gets logged for manual reconciliation.
  markReferralConverted(referral.id);

  if (!referrer.stripe_customer_id) {
    console.log(
      `[referral] Referral ${referral.id} converted but referrer ${referrer.id} (${referrer.email}) has no Stripe customer; credit will be applied when they next subscribe.`,
    );
    // Still email the referrer — they earned the credit even if it's deferred
    await sendReferralConvertedEmail({
      referrer_full_name: referrer.full_name,
      referrer_email: referrer.email,
      referred_email: referredUser.email,
      credit_amount_usd: (REFERRAL_CREDIT_CENTS / 100).toFixed(2),
      deferred: true,
    }).catch(() => {/* email already self-logs */});
    return;
  }

  try {
    const stripe = getStripe();
    const tx = await stripe.customers.createBalanceTransaction(referrer.stripe_customer_id, {
      amount: -REFERRAL_CREDIT_CENTS, // negative = credit to customer
      currency: "usd",
      description: `Vancomyzer referral credit (1 month) — referred ${referredUser.email}`,
    });
    markReferralCreditApplied(referral.id, REFERRAL_CREDIT_CENTS, tx.id);
    console.log(
      `[referral] Credit $${(REFERRAL_CREDIT_CENTS / 100).toFixed(2)} applied to referrer ${referrer.id} (${referrer.email}) for referral ${referral.id}`,
    );

    await sendReferralConvertedEmail({
      referrer_full_name: referrer.full_name,
      referrer_email: referrer.email,
      referred_email: referredUser.email,
      credit_amount_usd: (REFERRAL_CREDIT_CENTS / 100).toFixed(2),
      deferred: false,
    }).catch(() => {/* email already self-logs */});

    logSecurityEvent({
      user_id: referrer.id,
      username: referrer.username,
      action: "REFERRAL_CREDIT_APPLIED",
      details: JSON.stringify({
        referral_id: referral.id,
        referred_user_id: referredUser.id,
        credit_cents: REFERRAL_CREDIT_CENTS,
        stripe_balance_transaction_id: tx.id,
      }),
      severity: "info",
    });
  } catch (err) {
    console.error(`[referral] Stripe credit failed for referral ${referral.id}:`, err);
  }
}

/**
 * Department subscription provisioning + sync.
 *
 * - First fire (subscription.created): create institutional_accounts row,
 *   link admin user to it as institution admin, upgrade their tier, send
 *   welcome email with magic-link sign-in.
 * - Subsequent fires (subscription.updated): just sync subscription_status
 *   + expiry + price_id on the institution row.
 *
 * Idempotent: institution lookup by stripe_subscription_id prevents
 * double-provisioning if Stripe replays the event.
 */
async function handleDepartmentSubscriptionEvent(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) {
    console.warn(`[stripe-webhook] department sub ${sub.id} has no customer id. Ignoring.`);
    return;
  }

  const institutionName = sub.metadata?.institution_name ?? "Unknown institution";
  const adminEmail = sub.metadata?.admin_email ?? "";
  const adminUserId = sub.metadata?.admin_user_id ? Number(sub.metadata.admin_user_id) : null;
  const seats = sub.metadata?.seats ? Math.max(5, Math.min(20, Number(sub.metadata.seats))) : 20;

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const status = localStatusFromStripe(sub.status);
  const expiry = expiryFromSubscription(sub);

  // Idempotency check — has this subscription already been provisioned?
  let institution = findInstitutionByStripeSubscriptionId(sub.id)
    ?? findInstitutionByStripeCustomerId(customerId);

  if (!institution) {
    // First fire — provision the institution.
    const adminUser = (adminUserId ? findInstitutionAdminCandidate(adminUserId, adminEmail) : null)
      ?? (adminEmail ? findUserByEmail(adminEmail) : null)
      ?? (adminEmail ? findUserByLogin(adminEmail) : null);
    if (!adminUser) {
      console.warn(
        `[stripe-webhook] department sub ${sub.id} — admin user not found (id=${adminUserId} email=${adminEmail}). Subscription will be created without a linked admin.`,
      );
    }

    const institutionId = createInstitutionalAccount({
      institution_name: institutionName,
      billing_email: adminEmail || (adminUser?.email ?? ""),
      plan_tier: "department",
      seats_allocated: seats,
      subscription_start: new Date().toISOString(),
      subscription_expiry: expiry,
      baa_status: "not_requested",
      baa_requested_at: null,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      subscription_status: status,
    });
    setInstitutionStripeCustomer(institutionId, customerId);
    applyInstitutionSubscriptionUpdate(institutionId, {
      status,
      expiry,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
    });

    if (adminUser) {
      setUserInstitution(adminUser.id, institutionId, "admin");
      setUserTier(adminUser.id, "department", expiry ?? undefined);
      recountSeats(institutionId);

      // Welcome email — failure is non-fatal; the institution is provisioned regardless.
      try {
        const magicLinkToken = issueMagicLinkToken(adminUser.email);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://vancomyzer.com";
        const magicLinkUrl = `${baseUrl}/api/auth/magic-link/callback?token=${encodeURIComponent(magicLinkToken)}`;
        await sendDepartmentWelcomeEmail({
          adminName: adminUser.full_name ?? adminUser.username,
          adminEmail: adminUser.email,
          institutionName,
          seats,
          trialEndsAt: expiry,
          magicLinkUrl,
        });
      } catch (err) {
        console.error("[stripe-webhook] department welcome email failed (non-fatal):", err);
      }
    }

    logSecurityEvent({
      user_id: adminUser?.id ?? null,
      username: adminUser?.username ?? null,
      action: "DEPARTMENT_PROVISIONED",
      details: JSON.stringify({
        institution_id: institutionId,
        institution_name: institutionName,
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
        seats,
        status,
        expiry,
        price_id: priceId,
      }),
      severity: "info",
    });
    return;
  }

  // Subsequent fire — sync subscription state on the institution row.
  applyInstitutionSubscriptionUpdate(institution.id, {
    status,
    expiry,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
  });

  // Re-derive seats_allocated from the price ID. This is what lets a
  // Small→Large upgrade (or Large→Small downgrade) automatically bump
  // the seat cap on the institution row without a manual update.
  const newSeatCap = seatsForDepartmentPriceId(priceId);
  const seatCapChanged = newSeatCap != null && newSeatCap !== institution.seats_allocated;
  if (seatCapChanged) {
    setInstitutionSeatsAllocated(institution.id, newSeatCap);
  }

  logSecurityEvent({
    user_id: null,
    username: null,
    action: "DEPARTMENT_SUBSCRIPTION_UPDATED",
    details: JSON.stringify({
      institution_id: institution.id,
      institution_name: institution.institution_name,
      stripe_subscription_id: sub.id,
      status,
      expiry,
      price_id: priceId,
      seats_allocated: seatCapChanged ? newSeatCap : institution.seats_allocated,
      seats_cap_changed: seatCapChanged,
    }),
    severity: "info",
  });
}

function findInstitutionAdminCandidate(userId: number, _email: string) {
  // Local helper — keep import surface tight in the webhook handler.
  // userId lookup is preferred since metadata carries it; email fallback
  // is handled at the caller.
  const { findUserById } = require("@/lib/db") as typeof import("@/lib/db");
  return findUserById(userId);
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
