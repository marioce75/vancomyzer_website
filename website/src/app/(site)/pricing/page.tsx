import Link from "next/link";
import type { Metadata } from "next";
import { TIERS, type TierId } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Pricing — Vancomyzer™",
  description:
    "Vancomyzer™ subscription plans for individual clinicians, departments, and enterprise health systems.",
};

/**
 * Plans visible on the in-app pricing page. Drives all copy from
 * lib/tiers.ts so feature lists and pricing labels can never drift
 * from the gates that enforce them.
 *
 * Hospital is intentionally omitted from the visible grid — it's a
 * legacy DB slot kept for backward compatibility, not a tier we sell.
 * Department and Enterprise cover the org-scale market.
 */
const VISIBLE_TIERS: TierId[] = ["free", "individual_pro", "department", "enterprise"];

const RECOMMENDED_TIER: TierId = "individual_pro";

interface CardModel {
  id: TierId;
  recommended: boolean;
  cta: { label: string; href: string; external: boolean };
  ctaSubLabel?: string;
}

function buildCards(): CardModel[] {
  return VISIBLE_TIERS.map(id => {
    const tier = TIERS[id];
    let cta: CardModel["cta"];
    let ctaSubLabel: string | undefined;

    if (id === "free") {
      cta = { label: "Start Free", href: "/register", external: false };
    } else if (id === "individual_pro") {
      // Pricing page card routes to /settings/billing where the user
      // picks monthly or annual and the Stripe checkout fires.
      cta = { label: "Start 14-Day Trial", href: "/settings/billing", external: false };
      ctaSubLabel = "card required upfront · cancel anytime";
    } else {
      // Department + Enterprise — sales-driven, route to dosys.health/contact
      cta = { label: tier.cta.label, href: tier.cta.href, external: true };
    }

    return {
      id,
      recommended: id === RECOMMENDED_TIER,
      cta,
      ctaSubLabel,
    };
  });
}

export default function PricingPage() {
  const cards = buildCards();

  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--color-primary)" }}>
          Plans &amp; Pricing
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--color-secondary)" }}>
          AUC-guided vancomycin dosing for every practice setting.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => {
          const tier = TIERS[card.id];
          const isRecommended = card.recommended;
          return (
            <div
              key={card.id}
              className="relative flex flex-col rounded-lg border p-6"
              style={{
                borderColor: isRecommended ? "#0d9488" : "var(--color-border)",
                background: "var(--color-bg)",
                boxShadow: isRecommended
                  ? "0 0 0 2px #0d9488, 0 4px 24px rgba(13,148,136,0.12)"
                  : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {isRecommended && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white"
                  style={{ background: "#0d9488" }}
                >
                  Recommended
                </span>
              )}

              <h2 className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
                {tier.name}
              </h2>
              <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                {tier.audience}
              </p>

              <div className="mt-5 mb-6">
                <span className="block text-2xl font-extrabold leading-tight" style={{ color: "var(--color-foreground)" }}>
                  {tier.priceLabel}
                </span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-foreground)" }}>
                    <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0d9488" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {card.cta.external ? (
                <a
                  href={card.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition"
                  style={{
                    background: isRecommended ? "#0d9488" : "transparent",
                    color: isRecommended ? "#ffffff" : "#0d9488",
                    border: isRecommended ? "none" : "1px solid #0d9488",
                  }}
                >
                  {card.cta.label}
                </a>
              ) : (
                <Link
                  href={card.cta.href}
                  className="block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition"
                  style={{
                    background: isRecommended ? "#0d9488" : "transparent",
                    color: isRecommended ? "#ffffff" : "#0d9488",
                    border: isRecommended ? "none" : "1px solid #0d9488",
                  }}
                >
                  {card.cta.label}
                </Link>
              )}

              {card.ctaSubLabel && (
                <p className="mt-2 text-center text-[11px]" style={{ color: "var(--color-secondary)" }}>
                  {card.ctaSubLabel}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-12 text-center text-xs" style={{ color: "var(--color-secondary)", lineHeight: 1.6 }}>
        Every tier — including Free — includes the Colin 2019 two-compartment PK model, the Vancomyzer
        Obesity Model (auto-activated at BMI ≥ 40), all clinical safety guardrails, and full equation
        transparency. These are regulatory commitments under 21st Century Cures Act §3060.
      </p>
    </main>
  );
}
