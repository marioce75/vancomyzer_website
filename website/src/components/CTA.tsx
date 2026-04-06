"use client";

import Link from "next/link";

export const CTA_LINKS = {
  exploreWorkflow: { href: "/", label: "Open the calculator" },
  sampleCase: { href: "/calculator?age=58&weight_kg=82&serum_creatinine_mg_dl=1.4", label: "Review a sample case" },
  documentationSummary: { href: "/references", label: "Review references & methods" },
  trustEvidence: { href: "/references", label: "Explore references & methods" },
  contact: { href: "/contact", label: "Contact us" },
  requestEvaluation: { href: "/contact", label: "Request a workflow evaluation" },
} as const;

type CTAVariant = keyof typeof CTA_LINKS;

interface CTAProps {
  variant: CTAVariant;
  primary?: boolean;
  className?: string;
}

export default function CTA({ variant, primary, className = "" }: CTAProps) {
  const { href, label } = CTA_LINKS[variant];

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition ${className}`}
      style={
        primary
          ? {
              background: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
              color: "var(--color-card, var(--color-bg))",
              fontWeight: 700,
            }
          : {
              background: "var(--color-card, #ffffff)",
              border: "1px solid var(--color-border)",
              color: "var(--color-secondary)",
            }
      }
      onMouseEnter={(e) => {
        if (!primary) {
          (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-card, #ffffff)";
        }
      }}
      onMouseLeave={(e) => {
        if (!primary) {
          (e.currentTarget as HTMLElement).style.background = "var(--color-card, #ffffff)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
        }
      }}
    >
      {label}
    </Link>
  );
}
