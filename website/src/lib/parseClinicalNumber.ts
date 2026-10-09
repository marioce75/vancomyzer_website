/** Explicit clinical entry grammar, independent of display language.
 * Both decimal marks are accepted; grouping is never inferred from locale.
 * A nonzero 1–3 digit integer plus exactly three decimals is ambiguous.
 * Add a trailing zero to explicitly confirm a three-place decimal.
 * Blank, incomplete and invalid input return null, never a partial value.
 */
export const AMBIGUOUS_NUMBER = "Ambiguous separator: remove it for a whole number, or add a trailing zero to confirm a decimal.";
export const INVALID_NUMBER = "Use digits with one decimal point or comma, without grouping, units or trailing characters. Complete the decimal before continuing.";
export const NUMBER_RANGE = "Enter a number within this field's permitted range.";
const grouping = /^-?0*[1-9][0-9]{0,2}[.,][0-9]{3}$/;
export function clinicalNumberError(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (grouping.test(text)) return AMBIGUOUS_NUMBER;
  return parseClinicalNumber(text) === null ? INVALID_NUMBER : null;
}
export function parseClinicalNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!/^-?(?:[0-9]+(?:[.,][0-9]+)?|[.,][0-9]+)$/.test(text) || grouping.test(text)) return null;
  const value = Number(text.replace(",", ".")); // grammar above permits only one decimal mark
  return Number.isFinite(value) ? value : null;
}
/** Numeric prefill is already canonical, so explicitly mark ambiguous decimals. */
export function formatClinicalInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  const text = String(value);
  return grouping.test(text) ? `${text}0` : text;
}
export function hasInvalidNumericValues(value: unknown): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  return value !== null && typeof value === "object" && Object.values(value).some(hasInvalidNumericValues);
}

// Session drafts must not turn NaN into JSON null (an absent optional field).
const INVALID_DRAFT_NUMBER = "__invalid_clinical_numeric_entry__";
export const clinicalDraftReplacer = (_key: string, value: unknown): unknown =>
  typeof value === "number" && !Number.isFinite(value) ? INVALID_DRAFT_NUMBER : value;
export const clinicalDraftReviver = (_key: string, value: unknown): unknown =>
  value === INVALID_DRAFT_NUMBER ? NaN : value;
