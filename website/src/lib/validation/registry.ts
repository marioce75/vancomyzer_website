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
import { NEELY_2014_TROUGH_PLAUSIBILITY } from "./cases/neely-2014-trough-plausibility";

// Cases are wired in as the curation lands. Order matters — appears in
// this order on /transparent-dosing/cases. Group by source for scannability.
// Each case file co-locates the citation, patient inputs, published values,
// and tolerance so a reviewer can verify in isolation.
//
// v1 publishes 3 cases that met our verification bar (primary-source numbers
// extractable; not behind a paywall we couldn't access; not a "cohort
// aggregate posing as an individual case"). The original target was 8; the
// 5 we couldn't verify are documented in the page's limitations panel
// rather than silently dropped.

export const CASES: PublishedCase[] = [
  COLIN_2019_TYPICAL_ADULT,
  SMIT_2020_MORBIDLY_OBESE,
  NEELY_2014_TROUGH_PLAUSIBILITY,
];

export function getCaseById(id: string): PublishedCase | undefined {
  return CASES.find((c) => c.id === id);
}
