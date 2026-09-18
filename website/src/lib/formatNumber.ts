/**
 * Display formatting for clinical result numbers.
 *
 * Presentation only — never use these in the PK engine or in any comparison
 * against a threshold. Rounding happens at the display boundary; the engine
 * keeps full precision.
 *
 * `fmt` rounds to at most `maxDecimals` places and then drops trailing zeros,
 * so results read 1.5 rather than 1.50 and 600 rather than 600.0.
 */

/** Strips trailing zeros (and a bare decimal point) from an already-fixed string. */
export function trimTrailingZeros(fixed: string): string {
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/\.?0+$/, "");
}

/**
 * Round to `maxDecimals` and drop trailing zeros.
 *
 * fmt(1.499, 1) → "1.5" · fmt(2, 2) → "2" · fmt(600.04, 1) → "600"
 * Non-finite or nullish values return `fallback` (an em dash by default), so
 * a missing result never renders as "NaN" or "0".
 */
export function fmt(
  value: number | null | undefined,
  maxDecimals = 1,
  fallback = "—"
): string {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = trimTrailingZeros(n.toFixed(maxDecimals));
  // Avoid rendering "-0" when a tiny negative rounds to zero.
  return rounded === "-0" ? "0" : rounded;
}
