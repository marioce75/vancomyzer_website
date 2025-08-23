export function calculateLoadingDose(
  weightKg: number,
  perKgMg: number = 25,
  maxMg: number = 3000,
  roundToMg: number = 250
) {
  const w = Math.max(0, Number(weightKg) || 0);
  const perkg = Math.max(0, Number(perKgMg) || 0);
  const raw = w * perkg;
  const capped = Math.min(maxMg, raw);
  const rounded = Math.round(capped / roundToMg) * roundToMg;
  return {
    ld_mg: rounded,
    raw_mg: raw,
    per_kg_mg: perkg,
    max_mg: maxMg,
    round_to_mg: roundToMg,
    warning: capped < raw ? "capped_at_max" : null,
  };
}
