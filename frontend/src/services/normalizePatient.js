// Centralized patient field normalization and unwrapping
// Ensures a flat shape compatible with backend Pydantic models (PatientInput)
export function normalizePatientFields(input = {}) {
  // Unwrap legacy { patient: {...} }
  const raw = input && typeof input === 'object' && input.patient ? input.patient : input;

  const toNum = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Map potential aliases to API field names
  const age_years = toNum(
    raw.age_years ?? raw.ageYears ?? raw.age ?? raw.age_y ?? raw.age_str
  );

  const weight_kg = toNum(
    raw.weight_kg ?? raw.weight ?? raw.total_body_weight_kg ?? raw.tbw_kg ?? raw.weight_str
  );

  const height_cm = toNum(
    raw.height_cm ?? raw.height ?? raw.height_cm_str
  );

  // API expects `serum_creatinine` (mg/dL)
  const serum_creatinine = toNum(
    raw.serum_creatinine ??
      raw.serum_creatinine_mg_dl ??
      raw.scr ??
      raw.s_cr ??
      raw.sc ??
      raw.SCr ??
      raw.serum_creatinine_str
  );

  // Pass through known non-numeric fields when provided
  const normalized = {
    population_type: raw.population_type,
    age_years,
    age_months: toNum(raw.age_months),
    gestational_age_weeks: toNum(raw.gestational_age_weeks),
    postnatal_age_days: toNum(raw.postnatal_age_days),
    gender: raw.gender,
    weight_kg,
    height_cm,
    serum_creatinine,
    indication: raw.indication,
    severity: raw.severity,
    is_renal_stable: raw.is_renal_stable,
    is_on_hemodialysis: raw.is_on_hemodialysis,
    is_on_crrt: raw.is_on_crrt,
    crcl_method: raw.crcl_method,
    custom_crcl: toNum(raw.custom_crcl),
  };

  // Remove undefined keys to keep payload clean
  Object.keys(normalized).forEach((k) => normalized[k] === undefined && delete normalized[k]);
  return normalized;
}
