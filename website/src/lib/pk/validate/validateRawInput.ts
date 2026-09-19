/** Validate before normalization: never repair invalid clinical inputs silently. */
export function validateRawInput(
  input: unknown,
  existing = true,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const object = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  if (!object(input)) return { request: "A request object is required." };
  const check = (
    o: Record<string, unknown>,
    key: string,
    prefix: string,
    min: number,
    max: number,
    optional = false,
  ) => {
    const v = o[key];
    if (optional && v === undefined) return;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
      errors[`${prefix}.${key}`] =
        `Must be a finite number from ${min} to ${max}.`;
  };
  if (!object(input.patient)) errors.patient = "Patient inputs are required.";
  else {
    const p = input.patient;
    check(p, "age", "patient", 18, 120);
    check(p, "weight_kg", "patient", 30, 400);
    check(p, "serum_creatinine_mg_dl", "patient", 0.1, 10);
    if (p.height_cm !== 0) check(p, "height_cm", "patient", 100, 250, true);
    if (
      p.sex !== undefined &&
      !["male", "female", ""].includes(p.sex as string)
    )
      errors["patient.sex"] =
        "Use male, female, or an explicitly unknown value.";
    for (const key of ["dialysis_or_rrt", "ecmo"]) {
      if (p[key] !== undefined && typeof p[key] !== "boolean")
        errors[`patient.${key}`] = "Must be true or false.";
      if (p[key] === true)
        errors[`patient.${key}`] =
          "Outside the supported population; no calculation is available.";
    }
    if (
      p.serum_creatinine_unit !== undefined &&
      p.serum_creatinine_unit !== "mg/dL"
    )
      errors["patient.serum_creatinine_unit"] =
        "Convert and verify creatinine in mg/dL before submitting.";
  }
  if (!existing) return errors;
  if (!object(input.regimen)) errors.regimen = "Regimen inputs are required.";
  else {
    const r = input.regimen;
    // Resource/input-domain ceilings, not recommended doses or clinical targets.
    check(r, "dose_mg", "regimen", 0.001, 20000);
    check(r, "interval_hours", "regimen", 0.25, 168);
    check(r, "infusion_duration_hours", "regimen", 0.01, 168);
    check(r, "doses_given", "regimen", 1, 1000, true);
    if (r.doses_given !== undefined && !Number.isInteger(r.doses_given))
      errors["regimen.doses_given"] =
        "Dose count must be an integer from 1 to 1000; it is not rounded.";
    if (
      r.steady_state_confirmed !== undefined &&
      typeof r.steady_state_confirmed !== "boolean"
    )
      errors["regimen.steady_state_confirmed"] = "Must be true or false.";
    if (r.steady_state_confirmed === false && r.doses_given === undefined)
      errors["regimen.doses_given"] =
        "A known dose count is required for finite-history calculation.";
    check(r, "target_auc24", "regimen", 400, 600, true);
    if (r.dose_unit !== undefined && r.dose_unit !== "mg")
      errors["regimen.dose_unit"] = "Dose must be supplied in mg.";
  }
  for (const scope of [input, object(input.regimen) ? input.regimen : {}]) {
    for (const key of [
      "administration_history",
      "dose_history",
      "loading_dose_mg",
    ]) {
      const v = scope[key];
      if (v !== undefined && v !== null && (!Array.isArray(v) || v.length > 0))
        errors.administration_history =
          "Administration history is not modelled: loading-to-maintenance changes, irregular, held or interrupted doses require another workflow. No result is returned for supplied unsupported history.";
    }
  }
  if (!Array.isArray(input.levels) || input.levels.length > 8)
    errors.levels = "Provide an array of no more than eight levels.";
  else
    input.levels.forEach((raw, i) => {
      const prefix = `levels[${i}]`;
      if (!object(raw)) {
        errors[prefix] = "A level object is required.";
        return;
      }
      check(raw, "value_mcg_ml", prefix, 0.001, 1000);
      check(raw, "time_since_last_dose_hours", prefix, 0, 720);
      if (
        raw.collection_time !== undefined &&
        typeof raw.collection_time !== "string"
      )
        errors[`${prefix}.collection_time`] =
          "Use an ISO timestamp or an empty string for manual timing.";
      if (
        typeof raw.collection_time === "string" &&
        raw.collection_time !== ""
      ) {
        const m =
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(
            raw.collection_time,
          );
        const days = m
          ? new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()
          : 0;
        if (
          !m ||
          Number(m[2]) < 1 ||
          Number(m[2]) > 12 ||
          Number(m[3]) < 1 ||
          Number(m[3]) > days ||
          Number(m[4]) > 23 ||
          Number(m[5]) > 59 ||
          Number(m[6] ?? 0) > 59 ||
          !Number.isFinite(Date.parse(raw.collection_time))
        )
          errors[`${prefix}.collection_time`] =
            "Use a valid ISO date/time with UTC or an explicit timezone offset; ambiguous local timestamps are refused.";
      }
      if (
        raw.concentration_unit !== undefined &&
        !["mg/L", "mcg/mL", "µg/mL"].includes(raw.concentration_unit as string)
      )
        errors[`${prefix}.concentration_unit`] =
          "Concentration must be in mg/L or equivalent mcg/mL.";
    });
  return errors;
}
