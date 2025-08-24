export function calculateLoadingDose(
  weightKg: number | string,
  perKgMg: number | string = 25,
  maxMg: number | string = 3000,
  roundToMg: number | string = 250
) {
  const w = Math.max(0, Number(weightKg) || 0);
  const perkg = Math.max(0, Number(perKgMg) || 0);
  const cap = Math.max(0, Number(maxMg) || 0);
  const step = Math.max(1, Number(roundToMg) || 1);
  const raw = w * perkg;
  const capped = Math.min(cap, raw);
  const rounded = Math.round(capped / step) * step;
  return {
    ld_mg: rounded,
    raw_mg: raw,
    per_kg_mg: perkg,
    max_mg: cap,
    round_to_mg: step,
    warning: capped < raw ? 'capped_at_max' : null,
  } as const;
}

export function formatLoadingWarning(res: ReturnType<typeof calculateLoadingDose>) {
  return res.warning === 'capped_at_max' ? `Capped at ${res.max_mg} mg` : '';
}
