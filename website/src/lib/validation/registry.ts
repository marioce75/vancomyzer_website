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
import { SMIT_2020_MORBIDLY_OBESE } from "./cases/smit-2020-morbidly-obese";

// Cases are wired in as the curation lands. Order matters — appears in
// this order on /transparent-dosing/cases. Group by source for scannability.
// Each case file co-locates the citation, patient inputs, published values,
// and tolerance so a reviewer can verify in isolation.
//
// v2: Neely 2014 was dropped because (a) the test was circular — our Bayesian
// fitter trivially matched its own input observation — and (b) it sent a
// "trough-validation" message that conflicts with Vancomyzer's AUC-targeted
// positioning. New cases will favor AUC-focused validation papers and
// multi-platform Bayesian comparison studies (DoseMeRx, PrecisePK, InsightRx)
// where we can position Vancomyzer alongside named commercial tools with
// public delta numbers.

export const CASES: PublishedCase[] = [
  COLIN_2019_TYPICAL_ADULT,
  SMIT_2020_MORBIDLY_OBESE,
];

export function getCaseById(id: string): PublishedCase | undefined {
  return CASES.find((c) => c.id === id);
}
