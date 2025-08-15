// Single API base
export const API_BASE = 'https://vancomyzer.onrender.com/api';

// ---- Helpers --------------------------------------------------
function clamp(value, min, max) {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, min), max);
}

function toNumber(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Map UI (camelCase) -> backend PatientInput (snake_case)
export function normalizePatient(ui) {
  if (!ui) return {};
  const out = {
    population_type: (ui.populationType || ui.population_type || 'adult'),
    age_years: toNumber(ui.ageYears ?? ui.age_years),
    gender: ui.gender || ui.gender?.toLowerCase?.() || undefined,
    weight_kg: toNumber(ui.weightKg ?? ui.weight_kg),
    height_cm: toNumber(ui.heightCm ?? ui.height_cm),
    serum_creatinine: toNumber(ui.serum_creatinine ?? ui.serum_creatinine_mg_dl),
    indication: ui.indication,
    severity: ui.severity,
    is_renal_stable: ui.isRenalStable ?? ui.is_renal_stable ?? true,
    is_on_hemodialysis: ui.isOnHemodialysis ?? ui.is_on_hemodialysis ?? false,
    is_on_crrt: ui.isOnCrrt ?? ui.is_on_crrt ?? false,
    crcl_method: ui.crclMethod ?? ui.crcl_method ?? 'cockcroft_gault',
  };

  // Clamp/sanitize ranges
  if (out.age_years != null) out.age_years = Math.max(0, out.age_years);
  if (out.weight_kg != null) out.weight_kg = clamp(out.weight_kg, 0.1, 300);
  if (out.height_cm != null) out.height_cm = clamp(out.height_cm, 40, 250);
  if (out.serum_creatinine != null) out.serum_creatinine = clamp(out.serum_creatinine, 0.1, 20);

  // Remove undefined keys
  Object.keys(out).forEach(k => {
    if (out[k] === undefined || out[k] === null || out[k] === '') delete out[k];
  });
  return out;
}

// ---- Small utilities -----------------------------------------
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
function formatApiError(prefix, detail) {
  if (!detail) return `${prefix}.`;
  if (detail.detail) return `${prefix} (HTTP ${detail.status ?? res?.status ?? 400}): ${JSON.stringify(detail.detail)}`;
  return `${prefix}: ${JSON.stringify(detail)}`;
}

// ---- Core calls -----------------------------------------------
export async function calculateDosing(patientLike) {
  const patient = normalizePatient(patientLike);
  const endpoint = '/calculate-dosing';
  const payload = { patient };
  if (process.env.NODE_ENV !== 'production') console.log('API payload', endpoint, payload);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await safeJson(res);
    throw new Error(formatApiError('Population model calculation failed', detail));
  }
  return safeJson(res);
}

export async function bayesianOptimization(patientLike, levelsLike) {
  const patient = normalizePatient(patientLike);
  const levels = Array.isArray(levelsLike) ? levelsLike.filter(Boolean) : [];
  if (levels.length < 1) {
    throw new Error('At least one vancomycin level required for Bayesian optimization');
  }
  const endpoint = '/bayesian-optimization';
  const payload = { patient, levels };
  if (process.env.NODE_ENV !== 'production') console.log('API payload', endpoint, payload);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await safeJson(res);
    throw new Error(formatApiError('Bayesian optimization failed', detail));
  }
  return safeJson(res);
}

// Optional convenience wrapper used by the UI
export async function calculateOrBayes(patientLike, levelsLike) {
  const n = Array.isArray(levelsLike) ? levelsLike.length : 0;
  return n > 0
    ? bayesianOptimization(patientLike, levelsLike)
    : calculateDosing(patientLike);
}

// ---- Exports --------------------------------------------------
export default {
  calculateDosing,
  bayesianOptimization,
  calculateOrBayes,
  normalizePatient,
};