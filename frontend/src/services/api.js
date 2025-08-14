import axios from 'axios';

// ---- API BASE (Render production backend)
export const API_BASE = 'https://vancomyzer.onrender.com/api';

// Shared axios instance (adds CORS-friendly headers)
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ---- Helpers --------------------------------------------------

function sanitizeNumber(n) {
  if (n === '' || n === null || n === undefined) return undefined;
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
}

export function normalizePatient(raw) {
  if (!raw) throw new Error('Missing patient data');
  return {
    // enums must match backend: "adult" | "pediatric" | "neonate"
    population_type: raw.population_type || 'adult',
    age_years: sanitizeNumber(raw.age_years),
    age_months: sanitizeNumber(raw.age_months),
    gestational_age_weeks: sanitizeNumber(raw.gestational_age_weeks),
    postnatal_age_days: sanitizeNumber(raw.postnatal_age_days),
    gender: raw.gender || 'male', // "male" | "female" | "other"
    weight_kg: sanitizeNumber(raw.weight_kg),
    height_cm: sanitizeNumber(raw.height_cm),
    serum_creatinine: sanitizeNumber(raw.serum_creatinine),
    indication: raw.indication || 'other',
    severity: raw.severity || 'moderate',
    is_renal_stable: Boolean(raw.is_renal_stable ?? true),
    is_on_hemodialysis: Boolean(raw.is_on_hemodialysis ?? false),
    is_on_crrt: Boolean(raw.is_on_crrt ?? false),
    crcl_method: raw.crcl_method || 'cockcroft_gault', // "cockcroft_gault" | "mdrd" | "ckd_epi" | "custom"
    custom_crcl: sanitizeNumber(raw.custom_crcl),
  };
}

export function normalizeLevels(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(l => ({
      concentration: sanitizeNumber(l.concentration),
      time_after_dose_hours: sanitizeNumber(l.time_after_dose_hours),
      dose_given_mg: sanitizeNumber(l.dose_given_mg),
      infusion_duration_hours: sanitizeNumber(l.infusion_duration_hours) ?? 1.0,
      level_type: l.level_type || 'trough', // "trough" | "peak" | "random"
      draw_time: l.draw_time || new Date().toISOString(),
      notes: l.notes || undefined,
    }))
    .filter(l => Number.isFinite(l.concentration) && Number.isFinite(l.time_after_dose_hours));
}

// ---- Core calls -----------------------------------------------

// Population model (no levels)
export async function calculateDose(patient) {
  const payload = normalizePatient(patient);
  try {
    const { data } = await api.post('/calculate-dosing', payload);
    return data;
  } catch (err) {
    throw formatAxiosError(err, 'Population model calculation failed');
  }
}

// Bayesian optimization (requires >=1 level)
export async function bayesianOptimization(patient, levels) {
  const payload = {
    patient: normalizePatient(patient),
    levels: normalizeLevels(levels),
  };
  try {
    const { data } = await api.post('/bayesian-optimization', payload);
    return data;
  } catch (err) {
    throw formatAxiosError(err, 'Bayesian optimization failed');
  }
}

// Smart wrapper: picks endpoint by levels count
export async function calculateDosingSmart(patient, levels) {
  const lvls = normalizeLevels(levels);
  if (lvls.length > 0) {
    return bayesianOptimization(patient, lvls);
  }
  return calculateDose(patient);
}

// Interactive regimen update (keeps UI snappy)
// - If levels present -> re-run Bayesian with regimen context as a UI overlay
// - If no levels -> call population model and overlay regimen in the component
export async function interactiveUpdate(patient, levels, regimen) {
  const lvls = normalizeLevels(levels);
  if (lvls.length > 0) {
    const result = await bayesianOptimization(patient, lvls);
    // Return as-is; components can merge `regimen` into displayed recommendation
    return result;
  }
  const base = await calculateDose(patient);
  if (regimen) {
    base.recommendation = base.recommendation || {};
    base.recommendation.regimen = regimen;
  }
  return base;
}

// ---- Error formatting ------------------------------------------

function formatAxiosError(error, prefix) {
  // Prefer backend detail if available (pydantic/fastapi 422/400)
  const detail =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown error';
  const status = error?.response?.status;
  const out = new Error(`${prefix}${status ? ` (HTTP ${status})` : ''}: ${Array.isArray(detail) ? JSON.stringify(detail) : String(detail)}`);
  out.status = status;
  out.detail = detail;
  return out;
}