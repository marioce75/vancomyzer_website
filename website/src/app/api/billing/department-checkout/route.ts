/**
 * POST /api/billing/department-checkout
 * Body: { institution_name: string, seats: number }
 *
 * Creates a Stripe Checkout session for the self-serve Department tier
 * with a 14-day trial. Two flat SKUs:
 *   ≤10 seats → STRIPE_PRICE_DEPARTMENT_SMALL  ($500/mo)
 *   11–20    → STRIPE_PRICE_DEPARTMENT_LARGE   ($1,000/mo)
 *
 * The purchasing user becomes the institution admin once the webhook
 * provisions the institutional_account on subscription.created.
 *
 * Requires an authenticated session. Stripe customer is created on the
 * institution (not the user) so the institution owns billing.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserByLogin } from "@/lib/db";
import { getStripe, departmentPriceIdForSeats } from "@/lib/stripe";

const TRIAL_DAYS = 14;
const MIN_SEATS = 5;
const MAX_SEATS = 20;
const MAX_NAME_LEN = 200;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { institution_name?: unknown; seats?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const institutionName = typeof body.institution_name === "string" ? body.institution_name.trim() : "";
  if (institutionName.length === 0 || institutionName.length > MAX_NAME_LEN) {
    return NextResponse.json(
      { error: `institution_name is required (1–${MAX_NAME_LEN} characters).` },
      { status: 400 },
    );
  }

  const seatsRaw = typeof body.seats === "number" ? body.seats : Number(body.seats);
  const seats = Number.isFinite(seatsRaw) ? Math.floor(seatsRaw) : 0;
  if (seats < MIN_SEATS || seats > MAX_SEATS) {
    return NextResponse.json(
      { error: `seats must be an integer between ${MIN_SEATS} and ${MAX_SEATS}.` },
      { status: 400 },
    );
  }

  const priceId = departmentPriceIdForSeats(seats);
  if (!priceId) {
    return NextResponse.json(
      { error: "Department Stripe price IDs are not configured. Set STRIPE_PRICE_DEPARTMENT_SMALL / STRIPE_PRICE_DEPARTMENT_LARGE." },
      { status: 500 },
    );
  }

  const dbUser = findUserByLogin(email);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Create a NEW Stripe customer for the institution every time. We do
  // NOT reuse dbUser.stripe_customer_id — that one is tied to the user's
  // Individual Pro flow. Department billing belongs to the institution.
  const customer = await stripe.customers.create({
    email: dbUser.email,
    name: institutionName,
    metadata: {
      kind: "department",
      institution_name: institutionName,
      admin_user_id: String(dbUser.id),
      admin_username: dbUser.username,
      seats: String(seats),
    },
  });

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        kind: "department",
        institution_name: institutionName,
        admin_user_id: String(dbUser.id),
        admin_email: dbUser.email,
        seats: String(seats),
      },
    },
    payment_method_collection: "always",
    success_url: `${baseUrl}/settings/billing?dept_trial=started`,
    cancel_url: `${baseUrl}/upgrade/department?checkout=cancelled`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
    billing_address_collection: "auto",
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
