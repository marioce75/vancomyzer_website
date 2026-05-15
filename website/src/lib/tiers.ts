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

export type TierId = "free" | "individual_pro" | "department" | "hospital";

export type FeatureId =
  // Output / export
  | "export.pdf"
  | "export.note.copy"
  | "export.note.unwatermarked"
  | "export.custom_institution"
  // Interpretation surfaces (paywall — the prose is copy-paste equivalent
  // to export.note.copy, so it's gated to the same tier)
  | "interpretation.why_this_result"
  // Persistence
  | "history.calculation"
  // Org / multi-user
  | "org.admin_panel"
  | "org.audit_log"
  | "org.invite_users"
  // Hospital-tier infra (formerly Enterprise — merged into Hospital)
  | "hospital.emr_integration"
  | "hospital.custom_branding"
  | "hospital.baa"
  | "hospital.sso";

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
    id: "hospital",
    name: "Hospital",
    priceLabel: "Contact for pricing",
    audience: "Health systems + EMR integration",
    features: [
      "Everything in Department",
      "EMR integration (HL7/FHIR — Epic, Cerner)",
      "Custom branding on outputs",
      "SLA & uptime guarantee",
      "SOC 2 compliance documentation",
      "Business Associate Agreement (BAA)",
      "SSO / SAML",
      "Dedicated account manager",
      "White-glove onboarding",
    ],
    cta: {
      label: "Request Proposal",
      href: `${CONTACT_URL}?type=hospital`,
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
  hospital: 3,
};

const FEATURE_MIN_TIER: Record<FeatureId, TierId> = {
  // Free
  // (no feature gates at free — calculator + watermarked export are unconditional)

  // Individual Pro
  "export.pdf": "individual_pro",
  "export.note.copy": "individual_pro",
  "export.note.unwatermarked": "individual_pro",
  "export.custom_institution": "individual_pro",
  "interpretation.why_this_result": "individual_pro",
  "history.calculation": "individual_pro",

  // Department
  "org.admin_panel": "department",
  "org.audit_log": "department",
  "org.invite_users": "department",

  // Hospital (formerly Enterprise — merged here)
  "hospital.emr_integration": "hospital",
  "hospital.custom_branding": "hospital",
  "hospital.baa": "hospital",
  "hospital.sso": "hospital",
};

/**
 * Defensive fallback when a session/cookie is missing or carries a
 * tier value we no longer support.
 *
 * The Enterprise tier was retired and its features merged into Hospital.
 * Any stored "enterprise" values are coerced to "hospital" so existing
 * accounts keep their entitlements without a DB migration.
 */
export function normalizeTier(value: unknown): TierId {
  if (value === "enterprise") return "hospital";
  if (
    value === "free" ||
    value === "individual_pro" ||
    value === "department" ||
    value === "hospital"
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
