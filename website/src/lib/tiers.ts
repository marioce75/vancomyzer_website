/**
 * Single source of truth for Vancomyzer™ subscription tiers.
 *
 * Tier copy mirrors dosys.health/pricing. Update this file (not scattered
 * if-checks) when adding tiers, features, or pricing. Every gate, banner,
 * upgrade-prompt, and admin view should read from here.
 *
 * NEVER use this file to gate clinical safety features (high-BMI advisory,
 * RRT block, age >65 advisory, infusion-rate enforcement, AUC target
 * range, equation transparency). Those are non-tier-gated by regulatory
 * commitment under 21st Century Cures Act §3060.
 */

import { OPEN_ACCESS, OPEN_ACCESS_FEATURES } from "./openAccess";
import { COLIN_2019 } from "./pk/modelRegistry";

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
  // Org / multi-user (Department+)
  | "org.admin_panel"
  | "org.audit_log"
  | "org.invite_users"
  | "org.baa"
  // Hospital-tier infra (formerly Enterprise — merged into Hospital)
  | "hospital.emr_integration"
  | "hospital.custom_branding"
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
    priceLabel: "$0 · free permanently",
    audience: "Students, individual clinicians",
    features: [
      "Full AUC calculator (Empiric, 1-level, 2-level)",
      `${COLIN_2019.shortName} two-compartment PK model (every adult, every BMI)`,
      "All safety guardrails active",
      "DOI-linked inline references on every result",
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
      "Clinical note & PDF export for the medical record",
      "Calculation history (90-day retention, de-identified)",
      "Custom institution name on exported notes",
      "Email support (info@dosys.health)",
    ],
    cta: { label: "Start 14-Day Trial", href: "/settings/billing" },
    paid: true,
  },
  department: {
    id: "department",
    name: "Department",
    priceLabel: "$500/month (up to 10 seats) · $1,000/month (11–20 seats)",
    audience: "Hospital pharmacy departments (5–20 users)",
    features: [
      "Everything in Individual Pro",
      "5–20 user seats with shared workspace",
      "Admin panel & user management",
      "Institution-scoped audit logs (90-day retention)",
      "Priority email support (service terms by contract)",
      "Onboarding assistance",
    ],
    cta: { label: "Start 14-Day Trial", href: "/upgrade/department" },
    paid: true,
  },
  hospital: {
    id: "hospital",
    name: "Hospital",
    priceLabel: "Contact for pricing",
    audience: "Health systems",
    features: [
      "Everything in Department",
      "EMR/EHR integration (in development — not yet available)",
      "Custom branding on outputs (in development — not yet available)",
      "Uptime & support: service terms by contract",
      "SOC 2 Type I in progress (target Q4 2026)",
      "Business Associate Agreement (available after legal review — not yet available)",
      "SSO / SAML (in development — not yet available)",
      "Account management: service terms by contract",
      "White-glove onboarding",
    ],
    cta: {
      label: "Contact Sales",
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
  // (no feature gates at free — Bayesian calculator is unconditional; export
  // and history are Pro-gated below)

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
  // BAA is unlocked at Department because small hospital pharmacies
  // running pilots on the Department plan still need a Business
  // Associate Agreement on file before their legal team will let
  // them feed PHI into the calculator (even though we don't persist it).
  "org.baa": "department",

  // Hospital (formerly Enterprise — merged here)
  "hospital.emr_integration": "hospital",
  "hospital.custom_branding": "hospital",
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
  // Open-access launch mode (lib/openAccess.ts): calculator features that
  // work without an account are unlocked for everyone, whatever the tier
  // (anonymous visitors arrive here as "free"). All other features fall
  // through to the tier rules below. No runtime import cycle: openAccess.ts
  // imports FeatureId from this file with `import type`, which is erased.
  if (OPEN_ACCESS && OPEN_ACCESS_FEATURES.has(feature)) return true;

  const userRank = TIER_RANK[normalizeTier(tier)];
  const requiredRank = TIER_RANK[FEATURE_MIN_TIER[feature]];
  return userRank >= requiredRank;
}

/** Suggested upgrade target for users blocked from a feature. */
export function upgradeTargetFor(feature: FeatureId): TierConfig {
  return TIERS[FEATURE_MIN_TIER[feature]];
}
