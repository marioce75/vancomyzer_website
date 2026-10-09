/** Strict raw-entry parser. Ambiguous single separators need an explicit choice.
 * Canonical form state is separate from raw text; no measurement precision is added.
 */
export type NumberInterpretation = "decimal" | "whole";
export const AMBIGUOUS_NUMBER = "This number is ambiguous. Choose the intended value below before continuing.";
export const INVALID_NUMBER = "Use digits with one decimal point or comma, without grouping, units or trailing characters. Complete the decimal before continuing.";
export const NUMBER_RANGE = "Enter a number within this field's permitted range.";
export const INVALID_CLINICAL_ENTRY = "__unresolved_clinical_number__";
const grouping = /^-?0*[1-9][0-9]{0,2}[.,][0-9]{3}$/;
const grammar = /^-?(?:[0-9]+(?:[.,][0-9]+)?|[.,][0-9]+)$/;
export function clinicalNumberChoices(raw: string): { decimal: number; whole: number } | null {
  const text = raw.trim();
  if (!grouping.test(text)) return null;
  return { decimal: Number(text.replace(",", ".")), whole: Number(text.replace(/[.,]/, "")) };
}
export function parseClinicalNumber(raw: string | number | null | undefined, interpretation?: NumberInterpretation): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!grammar.test(text)) return null;
  const choices = clinicalNumberChoices(text);
  if (choices) return interpretation ? choices[interpretation] : null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
export function clinicalNumberError(raw: string, interpretation?: NumberInterpretation): string | null {
  if (!raw.trim()) return null;
  if (clinicalNumberChoices(raw) && !interpretation) return AMBIGUOUS_NUMBER;
  return parseClinicalNumber(raw, interpretation) === null ? INVALID_NUMBER : null;
}
/** For form state emitted by NumericTextInput or trusted numeric prefills ONLY.
 * Never use this function for raw keyboard, pasted or URL text.
 */
export function parseCanonicalClinicalNumber(canonical: string): number | null {
  if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(canonical)) return null;
  const value = Number(canonical);
  return Number.isFinite(value) ? value : null;
}
export function formatClinicalInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
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
