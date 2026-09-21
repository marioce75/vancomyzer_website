"use client";

/**
 * Pricing presentation page (Free, Individual Pro, Hospital Site).
 * Decoupled from lib/tiers.ts, which stays the feature-gate source of truth.
 * Keep the plan facts here, in lib/tiers.ts and on dosys.health/pricing in
 * step. Since the 15 Sep 2026 review: the core calculator is free
 * permanently, and features that do not exist yet are labelled
 * "not yet available" rather than listed as included.
 */

import Link from "next/link";
import { OPEN_ACCESS } from "@/lib/openAccess";
import { track } from "@/lib/analytics";
import { COLIN_2019 } from "@/lib/pk/modelRegistry";


/** A normal link/button CTA, or (open-access launch only) a plain, non-clickable label. */
type TierCta =
  | { label: string; href: string; external?: boolean }
  | { label: string; nonInteractive: true };

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
  cta: TierCta;
  ctaSubLabel?: string;
  badge?: string;
}

const TIERS: TierCard[] = [
  {
    name: "Free",
    audience: "Students, individual clinicians",
    price: {
      annual: { amount: "$0", suffix: "core calculator · free permanently" },
    },
    features: [
      "Full AUC calculator",
      `${COLIN_2019.shortName} PK model for all adults`,
      "Initial dosing and estimates using one or two levels",
      "DOI-linked references",
      "In-app bug reporting (free account)",
    ],
    cta: { label: "Start Free", href: "/register" },
  },
  {
    name: "Individual Pro",
    audience: "Pharmacists, Physicians, NPs, PAs",
    price: {
      annual: { amount: "$49.99", suffix: "/year · billed annually" },
    },
    features: [
      "Everything in Free",
      "PDF export",
      "Clinical-note copy",
      "“Why this result” interpretation",
      "Calculation history (90-day retention)",
      "Email support",
    ],
    cta: { label: "Start 14-Day Trial", href: "/settings/billing" },
    ctaSubLabel: "card required at signup · cancel anytime",
    badge: "Individual plan",
  },
  {
    name: "Hospital Site",
    audience: "One hospital, unlimited users",
    scope: "Includes critical-access hospitals",
    price: { annual: { amount: "$990 / $2,500", suffix: "/year · up to 100 beds / 101–400 beds" } },
    features: [
      "Individual Pro access for users at one site",
      "No implementation fee",
      "Annual term; two-year agreement available",
      "Standalone calculator; no EHR integration",
      "Institutional data use and any BAA require review before setup",
      "Site eligibility and account setup confirmed before billing",
    ],
    cta: { label: "Request site license", href: "https://dosys.health/contact?type=site-license", external: true },
  },

];

/**
 * Open-access launch period (see lib/openAccess.ts): on top of the core
 * calculator (free permanently), PDF export, clinical-note copy and "why this
 * result" interpretation are free for everyone without an account. Only the
 * self-serve Free and Individual Pro calls to action change; calculation
 * history still needs Individual Pro; Hospital Site remains available by inquiry. With NEXT_PUBLIC_OPEN_ACCESS=false this is exactly TIERS,
 * so the page renders as it did before the launch period.
 */
const DISPLAY_TIERS: TierCard[] = OPEN_ACCESS
  ? TIERS.map((tier) => {
      if (tier.name === "Free") {
        return {
          ...tier,
          cta: { label: "Open Calculator", href: "/calculator" },
          ctaSubLabel: "no account needed during the launch period",
        };
      }
      if (tier.name === "Individual Pro") {
        return {
          ...tier,
          cta: { label: "Free during launch", nonInteractive: true },
          // Replaces "card required at signup". Only these three features are
          // open during launch; calculation history still needs Individual Pro.
          ctaSubLabel: "PDF export, note copy & interpretation · no account needed",
        };
      }
      return tier;
    })
  : TIERS;

export default function PricingClient() {

  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      {/* Open-access launch banner — not rendered when OPEN_ACCESS is false. */}
      {OPEN_ACCESS && (
        <div
          className="mx-auto mb-10 max-w-3xl rounded-lg border px-5 py-4 text-center"
          style={{ borderColor: "#1f5e96", background: "rgba(31,94,150,0.08)" }}
        >
          <p className="text-base font-semibold" style={{ color: "#1f5e96" }}>
            The core Vancomyzer calculator is free, permanently.
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
            During the launch period, PDF export, clinical-note copy and &ldquo;why this result&rdquo;
            interpretation are also free for everyone, with no account needed. After the launch period
            they return to Individual Pro. Calculation history requires Individual Pro; team administration
            and institutional features require a separate scope review. Free users are never automatically enrolled in paid billing.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--color-primary)" }}>
          Transparent Pricing for Transparent Math
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--color-secondary)" }}>
          Plans for individual clinicians, pharmacy departments and health systems.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {DISPLAY_TIERS.map((tier) => {
          const isFeatured = tier.name === "Individual Pro";
          const cyclePrice = tier.price.annual;
          return (
            <div
              key={tier.name}
              className="relative flex flex-col rounded-lg border p-6"
              style={{
                borderColor: isFeatured ? "#1f5e96" : "var(--color-border)",
                background: "var(--color-bg)",
                boxShadow: isFeatured
                  ? "0 0 0 2px #1f5e96, 0 4px 24px rgba(31,94,150,0.12)"
                  : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {tier.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap"
                  style={{ background: "#1f5e96" }}
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

                    {f}
                  </li>
                ))}
              </ul>

              {(() => {
                // Filled-style (featured: Individual Pro) vs outlined-style (all others).
                // Hover darkens to teal-700 across the board; outlined fills in on hover.
                const baseStyle: React.CSSProperties = isFeatured
                  ? { background: "#1f5e96", color: "#ffffff", border: "1px solid #1f5e96" }
                  : { background: "transparent", color: "#1f5e96", border: "1px solid #1f5e96" };
                const hoverStyle: React.CSSProperties = {
                  background: "#1f5e96",
                  color: "#ffffff",
                  border: "1px solid #1f5e96",
                };
                const onEnter = (e: React.MouseEvent<HTMLElement>) => {
                  const el = e.currentTarget;
                  el.style.background = hoverStyle.background as string;
                  el.style.color = hoverStyle.color as string;
                  el.style.border = hoverStyle.border as string;
                };
                const onLeave = (e: React.MouseEvent<HTMLElement>) => {
                  const el = e.currentTarget;
                  el.style.background = baseStyle.background as string;
                  el.style.color = baseStyle.color as string;
                  el.style.border = baseStyle.border as string;
                };
                const btnClass = "block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition";

                // Open-access launch only: a plain label, deliberately not a link
                // or button (dashed border so it doesn't read as clickable).
                if ("nonInteractive" in tier.cta) {
                  return (
                    <span
                      className={btnClass}
                      style={{
                        background: "rgba(31,94,150,0.08)",
                        color: "#1f5e96",
                        border: "1px dashed #1f5e96",
                        cursor: "default",
                      }}
                    >
                      {tier.cta.label}
                    </span>
                  );
                }

                // Only the open-access Free card links to the calculator; record
                // that click like the landing page's Open Calculator button.
                const trackOpenCalculator =
                  tier.cta.href === "/calculator"
                    ? () => track("Open Calculator", { source: "pricing" })
                    : undefined;

                return tier.cta.external ? (
                  <a
                    href={tier.cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnClass}
                    style={baseStyle}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                  >
                    {tier.cta.label}
                  </a>
                ) : (
                  <Link
                    href={tier.cta.href}
                    className={btnClass}
                    style={baseStyle}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                    onClick={trackOpenCalculator}
                  >
                    {tier.cta.label}
                  </Link>
                );
              })()}

              {/* Sub-label slot always reserved so the CTA button lands at
                  the same y-coordinate across all four cards, regardless of
                  whether this tier has a sub-label. */}
              <p
                className="mt-2 min-h-[18px] text-center text-[11px]"
                style={{ color: "var(--color-secondary)" }}
              >
                {tier.ctaSubLabel ?? ""}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
