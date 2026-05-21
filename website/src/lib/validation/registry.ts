/**
 * Central registry of Literature Reproducibility cases.
 *
 * Adding a case:
 *   1. Create src/lib/validation/cases/<id>.ts exporting a PublishedCase
 *   2. Import and append below
 *   3. Run `npm run test:cases` — case-runner will fail the build if our
 *      engine drifts from the published value beyond the case's tolerance
 *
 * Removing a case requires a written justification in the PR — these
 * are public on /transparent-dosing/cases, and silent removal looks
 * like we're hiding a failure.
 */

import type { PublishedCase } from "./types";
import { COLIN_2019_TYPICAL_ADULT } from "./cases/colin-2019-typical-adult";
import { COLIN_2019_ELDERLY_MILD_CKD } from "./cases/colin-2019-elderly-mild-ckd";
import { SMIT_2020_MORBIDLY_OBESE } from "./cases/smit-2020-morbidly-obese";
import { ADANE_2015_EXTREME_OBESITY } from "./cases/adane-2015-extreme-obesity";
import { CARRENO_2017_SPARSE_BAYESIAN_OBESE } from "./cases/carreno-2017-sparse-bayesian-obese";

// Cases are wired in as the curation lands. Order matters — appears in
// this order on /transparent-dosing/cases. Group by source for scannability.
// Each case file co-locates the citation, patient inputs, published values,
// and tolerance so a reviewer can verify in isolation.

export const CASES: PublishedCase[] = [
  // Implementation-correctness anchor — exact prior reproduction (typical adult)
  COLIN_2019_TYPICAL_ADULT,
  // FDecline + FSCR covariate composition (elderly + mild renal impairment)
  COLIN_2019_ELDERLY_MILD_CKD,
  // Obesity model: simulation-typical (Smit derivation) and real-measured (Adane cohort)
  SMIT_2020_MORBIDLY_OBESE,
  ADANE_2015_EXTREME_OBESITY,
  // Sparse-sampling Bayesian fit — tests the fitter, not just the prior
  CARRENO_2017_SPARSE_BAYESIAN_OBESE,
];

export function getCaseById(id: string): PublishedCase | undefined {
  return CASES.find((c) => c.id === id);
}
