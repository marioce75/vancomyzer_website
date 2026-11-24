/**
 * Identity of the timed-history study workflow.
 *
 * The calculation itself is the shipped adult Colin 2019 prior
 * (posterior/buildPriorParameters.ts) and the shipped finite-history
 * superposition (doseHistory.ts concentrationFromHistory). Neither is modified
 * here. CALCULATION_RELEASE_COMMIT is the production commit those files were
 * taken from (vancomyzer.com /api/health on 2026-11-24); the acceptance test
 * `calculationSourceUnchanged` checks the working tree still matches it.
 */
import { MODEL_MANIFEST_VERSION } from "../pk/modelRegistry";

export const CALCULATION_RELEASE_COMMIT = "feab09123a8c7124f77a86f59f8e63ac74f5f02b";
export const TIMED_WORKFLOW_VERSION = "hca-timed-draw-1.0.0-research";
export const PREDICTION_FUNCTION_ID = "studyTimed.predictAtDraw";
export const STUDY_MODEL_MANIFEST_VERSION = MODEL_MANIFEST_VERSION;

/** Short label printed in every output row. */
export const RELEASE_LABEL = `${TIMED_WORKFLOW_VERSION}; calc ${CALCULATION_RELEASE_COMMIT.slice(0, 7)}; model ${MODEL_MANIFEST_VERSION} (Colin 2019 adult, article Eq. 6 / Table 3)`;

/**
 * Calculation files whose content must be byte-identical to
 * CALCULATION_RELEASE_COMMIT. Checked by the acceptance tests.
 */
export const PINNED_CALCULATION_FILES = [
  "website/src/lib/pk/posterior/buildPriorParameters.ts",
  "website/src/lib/pk/doseHistory.ts",
  "website/src/lib/pk/steadyStateTwoCompartment.ts",
  "website/src/lib/pk/modelRegistry.ts",
] as const;
