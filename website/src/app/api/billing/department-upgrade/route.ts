/**
 * POST /api/billing/department-upgrade
 * Body: { target: "small" | "large" }
 *
 * Switches the calling institution's Department subscription between the
 * two flat SKUs by updating the subscription's price in Stripe. Charges
 * are prorated automatically. The webhook receives the resulting
 * subscription.updated event and re-derives seats_allocated from the new
 * price ID (see /api/billing/webhook).
 *
 * Auth: caller must be the institutional admin of the target institution
 * (enforced via requireInstitutionalAdmin from lib/team).
 *
 * Safety:
 *  - Refuses downgrade (Large → Small) if current seats_used > 10 — would
 *    leave the institution over the new cap.
 *  - Refuses upgrade on top of itself ("no-op" → return 200 with a hint).
 *  - Refuses if no active Stripe subscription is linked to the institution.
 */

import { NextResponse } from "next/server";
import { requireInstitutionalAdmin } from "@/lib/team";
import { getStripe, seatsForDepartmentPriceId } from "@/lib/stripe";
import { logSecurityEvent, recountSeats, getInstitutionalAccount } from "@/lib/db";

const SMALL_CAP = 10;
const LARGE_CAP = 20;

export async function POST(req: Request) {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  let body: { target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const target = body.target;
  if (target !== "small" && target !== "large") {
    return NextResponse.json(
      { error: "target must be 'small' or 'large'." },
      { status: 400 },
    );
  }

  const targetPriceId = target === "small"
    ? process.env.STRIPE_PRICE_DEPARTMENT_SMALL
    : process.env.STRIPE_PRICE_DEPARTMENT_LARGE;
  if (!targetPriceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_DEPARTMENT_${target.toUpperCase()} env var is not configured.` },
      { status: 500 },
    );
  }

  const account = gate.account;
  if (!account.stripe_subscription_id) {
    return NextResponse.json(
      {
        error: "This institution has no active Stripe subscription. Contact sales for help.",
      },
      { status: 409 },
    );
  }

  // No-op guard — already on the target tier.
  if (account.stripe_price_id === targetPriceId) {
    return NextResponse.json({
      ok: true,
      message: `Already on the ${target === "small" ? "Up to 10" : "Up to 20"} seat plan. No change applied.`,
      no_op: true,
    });
  }

  // Downgrade safety — don't shrink the cap below current usage.
  if (target === "small") {
    recountSeats(account.id);
    const refreshed = getInstitutionalAccount(account.id);
    const seatsUsed = refreshed?.seats_used ?? account.seats_used;
    if (seatsUsed > SMALL_CAP) {
      return NextResponse.json(
        {
          error: `Cannot downgrade to the ${SMALL_CAP}-seat plan — your team currently uses ${seatsUsed} seats. Remove ${seatsUsed - SMALL_CAP} member${seatsUsed - SMALL_CAP === 1 ? "" : "s"} from /team first, then retry.`,
          seats_used: seatsUsed,
          seats_target_cap: SMALL_CAP,
        },
        { status: 409 },
      );
    }
  }

  // Fetch the subscription to find the item id we need to update.
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item) {
    return NextResponse.json(
      { error: "Stripe subscription has no line items." },
      { status: 502 },
    );
  }

  // Atomically swap the price. Stripe creates prorated invoice line items
  // for the difference; new monthly charge takes effect at the next cycle.
  await stripe.subscriptions.update(account.stripe_subscription_id, {
    items: [{ id: item.id, price: targetPriceId }],
    proration_behavior: "create_prorations",
    metadata: {
      ...subscription.metadata,
      seats: target === "small" ? String(SMALL_CAP) : String(LARGE_CAP),
      tier_change: `${seatsForDepartmentPriceId(account.stripe_price_id) ?? "?"}->${target === "small" ? SMALL_CAP : LARGE_CAP}`,
    },
  });

  // The seats_allocated will be re-derived by the webhook on the resulting
  // subscription.updated event. No DB write here — single source of truth
  // stays in the webhook handler so manual mutations can't drift.

  logSecurityEvent({
    user_id: gate.user.id,
    username: gate.user.username,
    action: "DEPARTMENT_TIER_CHANGED",
    details: JSON.stringify({
      institution_id: account.id,
      institution_name: account.institution_name,
      stripe_subscription_id: account.stripe_subscription_id,
      from_price_id: account.stripe_price_id,
      to_price_id: targetPriceId,
      target,
      target_cap: target === "small" ? SMALL_CAP : LARGE_CAP,
    }),
    severity: "info",
  });

  return NextResponse.json({
    ok: true,
    message:
      target === "large"
        ? `Upgraded to the ${LARGE_CAP}-seat plan. Stripe will prorate the difference on your next invoice; the seat cap will update within a few seconds.`
        : `Downgraded to the ${SMALL_CAP}-seat plan. Stripe will credit the difference on your next invoice; the seat cap will update within a few seconds.`,
    target_cap: target === "small" ? SMALL_CAP : LARGE_CAP,
  });
}
