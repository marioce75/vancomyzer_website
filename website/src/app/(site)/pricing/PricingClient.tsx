"use client";

/**
 * Pricing presentation page — mirrored verbatim from dosys.health/pricing
 * (Free, Individual Pro, Department / Hospital). Decoupled from lib/tiers.ts
 * so the gate-source-of-truth can keep four internal tier IDs while users
 * see a single Department / Hospital card identical to the marketing site.
 */

import { useState } from "react";
import Link from "next/link";

type BillingCycle = "annual" | "monthly";

interface TierCard {
  name: string;
  audience: string;
  /** Optional sub-line under the audience tagline (e.g., "Scoped to your institution"). */
  scope?: string;
  /** When omitted, falls back to a single-cycle price. */
  price: {
    annual: { amount: string; suffix: string };
    monthly?: { amount: string; suffix: string };
  };
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  ctaSubLabel?: string;
  badge?: string;
}

const TIERS: TierCard[] = [
  {
    name: "Free",
    audience: "Students, individual clinicians",
    price: {
      annual: { amount: "$0", suffix: "forever" },
    },
    features: [
      "Full AUC calculator",
      "Colin 2019 PK model",
      "Empiric, 1-level, 2-level workflows",
      "DOI-linked references",
      "Community support",
    ],
    cta: { label: "Start Free", href: "/register" },
  },
  {
    name: "Individual Pro",
    audience: "Pharmacists, Physicians, NPs, PAs",
    price: {
      annual: { amount: "$9.99", suffix: "/mo · billed annually" },
      monthly: { amount: "$19.99", suffix: "/mo" },
    },
    features: [
      "Everything in Free",
      "Unlimited calculations",
      "Clinical note export",
      "Calculation history",
      "Email support",
    ],
    cta: { label: "Start 14-Day Trial", href: "/settings/billing" },
    ctaSubLabel: "card required upfront · cancel anytime",
    badge: "Most Popular",
  },
  {
    name: "Department",
    audience: "Hospital pharmacy departments — self-serve",
    scope: "5–20 seats · 14-day free trial",
    price: {
      annual: { amount: "$500 / $1,000", suffix: "/mo · ≤10 seats or 11–20 seats" },
    },
    features: [
      "Everything in Individual Pro",
      "Up to 10 seats — $500/month",
      "11–20 seats — $1,000/month",
      "Admin panel with user management & audit logs",
      "Shared calculation history across the team",
      "Priority email support (24-hour SLA)",
      "Onboarding assistance",
    ],
    cta: { label: "Start 14-Day Trial", href: "/upgrade/department" },
    ctaSubLabel: "card required upfront · cancel anytime",
  },
  {
    name: "Hospital",
    audience: "Health systems with EMR + BAA requirements",
    scope: "Scoped to your institution",
    price: {
      annual: { amount: "Custom", suffix: "" },
    },
    features: [
      "Everything in Department",
      "Unlimited user seats",
      "EMR integration (HL7 / FHIR — Epic, Cerner, others)",
      "Custom hospital branding on outputs",
      "SLA & uptime guarantee",
      "SOC 2 compliance documentation",
      "Business Associate Agreement (BAA)",
      "Dedicated account manager & onboarding",
      "Priority support",
    ],
    cta: { label: "Contact Sales", href: "https://dosys.health/contact", external: true },
  },
];

export default function PricingClient() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");

  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--color-primary)" }}>
          Transparent Pricing for Transparent Math
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--color-secondary)" }}>
          From individual pharmacists to health systems — Vancomyzer&trade; scales with your needs.
        </p>
      </div>

      {/* Billing-cycle toggle */}
      <div className="mb-12 flex items-center justify-center gap-3">
        <div
          className="inline-flex rounded-full p-1"
          role="tablist"
          aria-label="Billing cycle"
          style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
        >
          {(["monthly", "annual"] as const).map((c) => {
            const active = cycle === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCycle(c)}
                className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                style={{
                  background: active ? "#0d9488" : "transparent",
                  color: active ? "#ffffff" : "var(--color-secondary)",
                  cursor: "pointer",
                }}
              >
                {c === "monthly" ? "Monthly" : "Annual"}
              </button>
            );
          })}
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: "rgba(13,148,136,0.12)", color: "#0d9488" }}
        >
          Save up to 50%
        </span>
      </div>

      {/* Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const isFeatured = tier.badge === "Most Popular";
          const cyclePrice = cycle === "monthly" && tier.price.monthly ? tier.price.monthly : tier.price.annual;
          return (
            <div
              key={tier.name}
              className="relative flex flex-col rounded-lg border p-6"
              style={{
                borderColor: isFeatured ? "#0d9488" : "var(--color-border)",
                background: "var(--color-bg)",
                boxShadow: isFeatured
                  ? "0 0 0 2px #0d9488, 0 4px 24px rgba(13,148,136,0.12)"
                  : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {tier.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap"
                  style={{ background: "#0d9488" }}
                >
                  {tier.badge}
                </span>
              )}

              <h2 className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
                {tier.name}
              </h2>
              <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                {tier.audience}
              </p>
              {tier.scope && (
                <p className="mt-0.5 text-xs italic" style={{ color: "var(--color-secondary)" }}>
                  {tier.scope}
                </p>
              )}

              <div className="mt-5 mb-6">
                <span className="block text-3xl font-extrabold leading-tight" style={{ color: "var(--color-foreground)" }}>
                  {cyclePrice.amount}
                </span>
                {cyclePrice.suffix && (
                  <span className="mt-1 block text-xs" style={{ color: "var(--color-secondary)" }}>
                    {cyclePrice.suffix}
                  </span>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-foreground)" }}>
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#0d9488" }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {tier.cta.external ? (
                <a
                  href={tier.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition"
                  style={{
                    background: isFeatured ? "#0d9488" : "transparent",
                    color: isFeatured ? "#ffffff" : "#0d9488",
                    border: isFeatured ? "none" : "1px solid #0d9488",
                  }}
                >
                  {tier.cta.label}
                </a>
              ) : (
                <Link
                  href={tier.cta.href}
                  className="block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition"
                  style={{
                    background: isFeatured ? "#0d9488" : "transparent",
                    color: isFeatured ? "#ffffff" : "#0d9488",
                    border: isFeatured ? "none" : "1px solid #0d9488",
                  }}
                >
                  {tier.cta.label}
                </Link>
              )}

              {tier.ctaSubLabel && (
                <p className="mt-2 text-center text-[11px]" style={{ color: "var(--color-secondary)" }}>
                  {tier.ctaSubLabel}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
