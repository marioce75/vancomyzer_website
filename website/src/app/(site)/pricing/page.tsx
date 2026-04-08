import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Vancomyzer™",
  description:
    "Vancomyzer subscription plans for individual pharmacists, departments, hospitals, and enterprise health systems.",
};

const tiers = [
  {
    name: "Free Individual",
    price: "$0",
    priceDetail: "forever",
    recommended: false,
    features: [
      "All clinical PK calculations",
      "Two-compartment Colin 2019 model",
      "PDF export with watermark",
      "Single user",
    ],
    cta: "Get Started",
    href: "/register",
    external: false,
  },
  {
    name: "Department",
    price: "Contact us",
    priceDetail: null,
    recommended: true,
    features: [
      "Everything in Free Individual",
      "Clean PDF export (no watermark)",
      "Clinical note export",
      "Calculation audit log",
      "Up to 20 users",
      "Department analytics dashboard",
    ],
    cta: "Contact Sales",
    href: "mailto:contact@vancomyzer.com?subject=Vancomyzer Department Plan Inquiry",
    external: true,
  },
  {
    name: "Hospital",
    price: "Contact us",
    priceDetail: null,
    recommended: false,
    features: [
      "Everything in Department",
      "Unlimited users",
      "BAA included",
      "SOC 2 documentation access",
      "Priority email support",
    ],
    cta: "Contact Sales",
    href: "mailto:contact@vancomyzer.com?subject=Vancomyzer Hospital Plan Inquiry",
    external: true,
  },
  {
    name: "Enterprise",
    price: "Contact us",
    priceDetail: null,
    recommended: false,
    features: [
      "Everything in Hospital",
      "Custom integrations",
      "Dedicated support engineer",
      "FHIR / EHR integration",
      "On-premise deployment option",
    ],
    cta: "Contact Sales",
    href: "mailto:contact@vancomyzer.com?subject=Vancomyzer Enterprise Plan Inquiry",
    external: true,
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--color-primary)" }}
        >
          Plans &amp; Pricing
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--color-secondary)" }}>
          AUC-guided vancomycin dosing for every practice setting.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const isRecommended = tier.recommended;
          return (
            <div
              key={tier.name}
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

              <h2
                className="text-lg font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                {tier.name}
              </h2>

              <div className="mt-4 mb-6">
                <span
                  className="text-3xl font-extrabold"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {tier.price}
                </span>
                {tier.priceDetail && (
                  <span
                    className="ml-1 text-sm"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    / {tier.priceDetail}
                  </span>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "#0d9488" }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {tier.external ? (
                <a
                  href={tier.href}
                  className="block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition"
                  style={{
                    background: isRecommended ? "#0d9488" : "transparent",
                    color: isRecommended ? "#ffffff" : "#0d9488",
                    border: isRecommended ? "none" : "1px solid #0d9488",
                  }}
                >
                  {tier.cta}
                </a>
              ) : (
                <Link
                  href={tier.href}
                  className="block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition"
                  style={{
                    background: "transparent",
                    color: "#0d9488",
                    border: "1px solid #0d9488",
                  }}
                >
                  {tier.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <p
        className="mt-12 text-center text-xs"
        style={{ color: "var(--color-secondary)" }}
      >
        All plans include the Colin 2019 two-compartment population PK model.
        Institutional plans include BAA and SOC&nbsp;2 documentation upon request.
      </p>
    </main>
  );
}
