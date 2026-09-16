/**
 * Strict parser for numbers a clinician types into the calculator: serum
 * creatinine, weight, height, age, dose, interval, infusion time, level value
 * and hours after dose.
 *
 * One decimal separator is accepted, written as "." or ",", so "1,2" is read
 * as 1.2 and never as 1 (which is what parseFloat returns). Anything that could
 * hide a misread value is rejected and returns null: letters or units ("75kg"),
 * exponents ("1e3"), a leading "+", inner spaces, more than one separator, and
 * thousands separators ("1,234.5", "1.234,5").
 *
 * null means "empty or not a number". Callers must treat it as a missing or
 * invalid field and must not substitute a value.
 *
 *   parseClinicalNumber("1.2")     → 1.2
 *   parseClinicalNumber("1,2")     → 1.2
 *   parseClinicalNumber(" 0,83 ")  → 0.83
 *   parseClinicalNumber("-3")      → -3
 *   parseClinicalNumber("1,234.5") → null
 *   parseClinicalNumber("abc")     → null
 *   parseClinicalNumber("")        → null
 */
export function parseClinicalNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  const text = raw.trim();
  if (text === "") return null;

  // Optional leading "-", digits, at most one "." or "," (leading or trailing
  // allowed), digits. Nothing else: no "+", exponent, space or second separator.
  const match = /^(-?)([0-9]*)([.,]?)([0-9]*)$/.exec(text);
  if (!match) return null;

  const [, sign, integerDigits, separator, fractionDigits] = match;
  if (integerDigits === "" && fractionDigits === "") return null;

  const normalized = `${sign}${integerDigits === "" ? "0" : integerDigits}${separator ? "." : ""}${fractionDigits}`;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
