import Link from "next/link";

export const CTA_LINKS = {
  exploreWorkflow: { href: "/", label: "Open the calculator" },
  sampleCase: { href: "/calculator?age=58&weight_kg=82&serum_creatinine_mg_dl=1.4", label: "Review a sample case" },
  documentationSummary: { href: "/trust-evidence", label: "Review a documentation-ready summary" },
  trustEvidence: { href: "/trust-evidence", label: "Explore the Trust & Evidence page" },
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
              background: "#00ff41",
              border: "1px solid #00ff41",
              color: "#000000",
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 700,
            }
          : {
              background: "#000000",
              border: "1px solid rgba(0,255,65,0.4)",
              color: "#00a827",
              fontFamily: "'Share Tech Mono', monospace",
            }
      }
    >
      {label}
    </Link>
  );
}
