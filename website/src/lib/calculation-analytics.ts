/** A completion is an explicit, current, successful response with a result.
 * This is an analytics contract check, not clinical validation. */
export function isCalculationCompletion(intent: string, data: Record<string, unknown>): boolean {
  return intent === "explicit" && !data.error_type &&
    (data.recommendation_type === "initial_regimen" || data.recommendation_type === "existing_regimen") &&
    typeof data.auc24 === "number" && Number.isFinite(data.auc24) &&
    Array.isArray(data.curve) && data.curve.length > 1 &&
    data.curve.every((point: unknown) => {
      if (!point || typeof point !== "object") return false;
      const p = point as Record<string, unknown>;
      return typeof p.time_hours === "number" && Number.isFinite(p.time_hours) &&
        typeof p.concentration === "number" && Number.isFinite(p.concentration);
    });
}
