/**
 * Central registry of literature cases.
 *
 * Adding a case:
 *   1. Create src/lib/validation/cases/<id>.ts exporting a PublishedCase
 *   2. Set comparison_kind honestly: "same_model_reproduction" only when the
 *      published value comes from the model the engine uses (Colin 2019);
 *      otherwise "cross_model_reference" (context only, no pass/fail)
 *   3. Import and append below
 *   4. Run `npm run test:cases`. It fails `npm test` if a same-model
 *      reproduction is outside its tolerance or has no published value.
 *
 * Removing a case requires a written justification in the PR. The cases
 * are public on /transparent-dosing/cases.
 */

import type { PublishedCase } from "./types";
import { COLIN_2019_TYPICAL_ADULT } from "./cases/colin-2019-typical-adult";
import { COLIN_2019_ELDERLY_MILD_CKD } from "./cases/colin-2019-elderly-mild-ckd";
import { SMIT_2020_MORBIDLY_OBESE } from "./cases/smit-2020-morbidly-obese";
import { ADANE_2015_EXTREME_OBESITY } from "./cases/adane-2015-extreme-obesity";
import { CARRENO_2017_SPARSE_BAYESIAN_OBESE } from "./cases/carreno-2017-sparse-bayesian-obese";
import { PATANWALA_2022_MULTI_PLATFORM } from "./cases/patanwala-2022-multi-platform";

// Cases are wired in as the curation lands. Order matters — appears in
// this order on /transparent-dosing/cases. Group by source for scannability.
// Each case file co-locates the citation, patient inputs, published values,
// and tolerance so a reviewer can verify in isolation.

export const CASES: PublishedCase[] = [
  // Same-model reproductions (Colin 2019): pass/fail at 1%
  COLIN_2019_TYPICAL_ADULT,
  COLIN_2019_ELDERLY_MILD_CKD,
  // Cross-model references: different published models or cohort statistics, context only
  SMIT_2020_MORBIDLY_OBESE,
  ADANE_2015_EXTREME_OBESITY,
  CARRENO_2017_SPARSE_BAYESIAN_OBESE,
  // Reference band: published multi-model comparison, no engine run
  PATANWALA_2022_MULTI_PLATFORM,
];

export function getCaseById(id: string): PublishedCase | undefined {
  return CASES.find((c) => c.id === id);
}
