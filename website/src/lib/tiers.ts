/**
 * Single source of truth for Vancomyzer™ subscription tiers.
 *
 * Tier copy mirrors dosys.health/pricing. Update this file (not scattered
 * if-checks) when adding tiers, features, or pricing. Every gate, banner,
 * upgrade-prompt, and admin view should read from here.
 *
 * NEVER use this file to gate clinical safety features (Obesity Model,
 * RRT block, age >65 advisory, infusion-rate enforcement, AUC target
 * range, equation transparency). Those are non-tier-gated by regulatory
 * commitment under 21st Century Cures Act §3060.
 */

export type TierId = "free" | "individual_pro" | "department" | "hospital" | "enterprise";

export type FeatureId =
  // Output / export
  | "export.pdf"
  | "export.note.copy"
  | "export.note.unwatermarked"
  | "export.custom_institution"
  // Persistence
  | "history.calculation"
  // Org / multi-user
  | "org.admin_panel"
  | "org.audit_log"
  | "org.invite_users"
  // Enterprise infra
  | "enterprise.emr_integration"
  | "enterprise.custom_branding"
  | "enterprise.baa"
  | "enterprise.sso";

export type Cta = {
  /** Action label users see on the upgrade button. */
  label: string;
  /** Where the upgrade CTA navigates. External (dosys.health) or internal. */
  href: string;
  /** Treated as external — open in new tab, no Next.js prefetch. */
  external?: boolean;
};

export interface TierConfig {
  id: TierId;
  /** Marketing display name. */
  name: string;
  /** Short price label for cards / banners. */
  priceLabel: string;
  /** Audience tagline used on pricing surfaces. */
  audience: string;
  /** Ordered marketing bullets (mirrors dosys.health/pricing). */
  features: string[];
  /** Primary call-to-action. */
  cta: Cta;
  /** Whether this tier is paid (any non-free tier). */
  paid: boolean;
}

const DOSYS = "https://dosys.health";
const PRICING_URL = `${DOSYS}/pricing`;
const CONTACT_URL = `${DOSYS}/contact`;

export const TIERS: Record<TierId, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0 forever",
    audience: "Students, individual clinicians",
    features: [
      "Full AUC calculator (Empiric, 1-level, 2-level)",
      "Colin 2019 two-compartment PK model",
      "Vancomyzer Obesity Model (auto-activated BMI ≥ 40)",
      "All safety guardrails active",
      "DOI-linked inline references on every result",
      "Watermarked clinical-note export",
      "Community support",
    ],
    cta: { label: "Start Free", href: "/register" },
    paid: false,
  },
  individual_pro: {
    id: "individual_pro",
    name: "Individual Pro",
    priceLabel: "$9.99/mo billed annually · $19.99/mo monthly",
    audience: "Pharmacists, physicians, NPs, PAs",
    features: [
      "Everything in Free",
      "Unlimited calculations",
      "Clinical note export with NO watermark",
      "Calculation history (≥ 90 days, de-identified)",
      "Custom institution name on exported notes",
      "Email support (info@dosys.health)",
    ],
    cta: { label: "Start 14-Day Trial", href: "/settings/billing" },
    paid: true,
  },
  department: {
    id: "department",
    name: "Department",
    priceLabel: "$500–$2,000/month",
    audience: "Hospital pharmacy departments (5–20 users)",
    features: [
      "Everything in Individual Pro",
      "5–20 user seats with shared workspace",
      "Admin panel & user management",
      "Audit logs (de-identified case IDs)",
      "Priority email support (24-hour SLA)",
      "Onboarding assistance",
    ],
    cta: {
      label: "Contact Sales",
      href: `${CONTACT_URL}?type=department`,
      external: true,
    },
    paid: true,
  },
  hospital: {
    // Legacy tier slot kept for backward compatibility with the existing
    // database CHECK constraint. Treated equivalent to Department for
    // gating purposes until Phase 4 migration cleans this up.
    id: "hospital",
    name: "Hospital",
    priceLabel: "Contact for pricing",
    audience: "Multi-department hospital deployments",
    features: [
      "Everything in Department",
      "Hospital-wide deployment",
      "Custom integration support",
    ],
    cta: {
      label: "Contact Sales",
      href: `${CONTACT_URL}?type=hospital`,
      external: true,
    },
    paid: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "$10K–$25K/year",
    audience: "Health systems + EMR integration",
    features: [
      "Everything in Department",
      "EMR integration (HL7/FHIR — Epic, Cerner)",
      "Custom branding on outputs",
      "SLA & uptime guarantee",
      "SOC 2 compliance documentation",
      "Business Associate Agreement (BAA)",
      "Dedicated account manager",
      "White-glove onboarding",
    ],
    cta: {
      label: "Request Proposal",
      href: `${CONTACT_URL}?type=enterprise`,
      external: true,
    },
    paid: true,
  },
};

/**
 * Feature → minimum tier required. The gating system grants a feature to
 * any tier at or above the minimum in the order defined below.
 */
const TIER_RANK: Record<TierId, number> = {
  free: 0,
  individual_pro: 1,
  department: 2,
  hospital: 2,
  enterprise: 3,
};

const FEATURE_MIN_TIER: Record<FeatureId, TierId> = {
  // Free
  // (no feature gates at free — calculator + watermarked export are unconditional)

  // Individual Pro
  "export.pdf": "individual_pro",
  "export.note.copy": "individual_pro",
  "export.note.unwatermarked": "individual_pro",
  "export.custom_institution": "individual_pro",
  "history.calculation": "individual_pro",

  // Department
  "org.admin_panel": "department",
  "org.audit_log": "department",
  "org.invite_users": "department",

  // Enterprise
  "enterprise.emr_integration": "enterprise",
  "enterprise.custom_branding": "enterprise",
  "enterprise.baa": "enterprise",
  "enterprise.sso": "enterprise",
};

/** Defensive fallback when a session/cookie is missing. */
export function normalizeTier(value: unknown): TierId {
  if (
    value === "free" ||
    value === "individual_pro" ||
    value === "department" ||
    value === "hospital" ||
    value === "enterprise"
  ) {
    return value;
  }
  return "free";
}

export function tierConfig(tier: TierId): TierConfig {
  return TIERS[tier];
}

export function isPaidTier(tier: TierId | string): boolean {
  return TIERS[normalizeTier(tier)].paid;
}

export function hasFeature(tier: TierId | string, feature: FeatureId): boolean {
  const userRank = TIER_RANK[normalizeTier(tier)];
  const requiredRank = TIER_RANK[FEATURE_MIN_TIER[feature]];
  return userRank >= requiredRank;
}

/** Suggested upgrade target for users blocked from a feature. */
export function upgradeTargetFor(feature: FeatureId): TierConfig {
  return TIERS[FEATURE_MIN_TIER[feature]];
}
