/**
 * Case-ID validation for the calculation history feature.
 *
 * The case_id field is the ONLY user-supplied free-text field that
 * gets persisted to the calculation_log table. Vancomyzer's PHI posture
 * (publicly committed on dosys.health/legal/privacy) requires that no
 * Protected Health Information is stored — so this validator exists as
 * defense-in-depth to reject obvious PHI patterns.
 *
 * Returns a sanitized string on success, or an Error message describing
 * why the input was rejected.
 *
 * Validation rules:
 *   - Empty / null → null (case_id is optional)
 *   - Trim whitespace, collapse internal whitespace
 *   - Max 64 chars
 *   - Reject sequences of ≥7 consecutive digits (likely SSN/MRN/phone)
 *   - Reject email-format strings
 *   - Reject "DOB:" / "MRN:" / "SSN:" / "phone:" prefixes (case-insensitive)
 *   - Reject explicit date patterns with 4-digit years (M/D/YYYY etc.)
 *
 * Allowed examples (clinician-supplied tracking):
 *   "ICU bed 12 trial 3", "Case-2026-04", "Pt-A vs Pt-B comparison",
 *   "ED dose check", "Floor 4 west - vanco redose"
 *
 * Rejected examples:
 *   "John Smith MRN 1234567", "DOB 1980-05-12", "555-12-3456",
 *   "patient.smith@hospital.org"
 */

export type ValidationResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: string };

const MAX_LEN = 64;
const PHI_PREFIXES = /\b(?:dob|mrn|ssn|phone|tel|hipaa|name|patient[_\s-]*name)\s*[:#=]/i;
const SEVEN_DIGIT_RUN = /\d{7,}/;
const EMAIL_LIKE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const DATE_WITH_YEAR = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b|\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b/;

export function validateCaseId(raw: unknown): ValidationResult {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, reason: "case_id must be a string." };

  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length === 0) return { ok: true, value: null };
  if (value.length > MAX_LEN) {
    return { ok: false, reason: `case_id must be at most ${MAX_LEN} characters.` };
  }
  if (PHI_PREFIXES.test(value)) {
    return { ok: false, reason: "case_id appears to contain PHI (DOB/MRN/SSN/name)." };
  }
  if (SEVEN_DIGIT_RUN.test(value)) {
    return { ok: false, reason: "case_id may not contain long digit sequences (looks like an identifier)." };
  }
  if (EMAIL_LIKE.test(value)) {
    return { ok: false, reason: "case_id may not contain an email address." };
  }
  if (DATE_WITH_YEAR.test(value)) {
    return { ok: false, reason: "case_id may not contain a date with a 4-digit year (looks like a DOB)." };
  }

  return { ok: true, value };
}
