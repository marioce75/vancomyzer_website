/**
 * FICTIONAL "lab results" for the demo's reveal step. Invented values, not
 * measurements of anyone. Kept apart from the prediction inputs: nothing in
 * src/lib/studyTimed imports this file (checked by the reference tests), and
 * the demo endpoint returns a value only for an explicit reveal request.
 */
export const FICTIONAL_LAB_RESULTS_MG_L: Readonly<Record<string, number>> = {
  "FICT-A01": 11.2,
  "FICT-A02": 19.8,
  "FICT-A03": 14.1,
  "FICT-A04": 25.6,
  "FICT-A05": 13.4,
};
