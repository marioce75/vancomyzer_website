import Link from "next/link";

export const CTA_LINKS = {
  exploreWorkflow: { href: "/", label: "Open the calculator" },
  sampleCase: { href: "/trust-evidence", label: "Review a sample case" },
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
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const styles = primary
    ? "bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-gray-900 px-4 py-2"
    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400 px-4 py-2";

  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {label}
    </Link>
  );
}
