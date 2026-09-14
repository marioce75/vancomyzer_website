/**
 * Open-access launch mode — the single switch for the temporary
 * "free for all clinicians, no sign-in required" period.
 *
 * ON by default. To restore required sign-in and paid tiers, set
 *   NEXT_PUBLIC_OPEN_ACCESS=false
 * in the hosting environment and redeploy. The value is baked in at build
 * time, so a rebuild is required (Render rebuilds automatically when an
 * environment variable is saved).
 *
 * What this switch controls (and nothing else):
 *  - middleware: "/", "/calculator" and "/api/calculate" stop requiring a session
 *  - tiers.hasFeature: calculator features in OPEN_ACCESS_FEATURES unlock for
 *    everyone. Account-bound features (history, team, BAA, EMR) are NOT
 *    unlocked — they need an account to function.
 *  - UI: upgrade prompts are hidden; pricing shows "free during launch".
 *
 * Clinical safety guardrails are never tier-gated, so they are unaffected.
 */

import type { FeatureId } from "./tiers";

export const OPEN_ACCESS: boolean = process.env.NEXT_PUBLIC_OPEN_ACCESS !== "false";

export function isOpenAccess(): boolean {
  return OPEN_ACCESS;
}

/**
 * Calculator features unlocked for every visitor while open access is on.
 * Keep this list to features that work without an account.
 */
export const OPEN_ACCESS_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>([
  "export.pdf",
  "export.note.copy",
  "export.note.unwatermarked",
  "interpretation.why_this_result",
]);
