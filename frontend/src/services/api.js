import axios from 'axios';

// ---- API BASE (Render) ----
// Prefer environment variable (e.g., REACT_APP_API_BASE) and fallback by hostname
const API_BASE = (
  process.env.REACT_APP_API_BASE && process.env.REACT_APP_API_BASE.trim()
) || (
  typeof window !== 'undefined' && window.location?.host?.includes('localhost')
    ? 'http://localhost:8001/api'
    : 'https://vancomyzer.onrender.com/api'
);

console.info('API_BASE =', API_BASE);

// Shared axios
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ---- helpers ----
function clean(obj) {
  if (obj == null) return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null || typeof v === 'undefined') continue;
    if (typeof v === 'object' && !Array.isArray(v)) out[k] = clean(v);
    else out[k] = v;
  }
  return out;
}

function normalizePatient(p) {
  // Don’t mutate caller’s object
  const c = clean({ ...(p || {}) });

  // Common numeric coercions (tolerant)
  const asNum = (x) => (x === '' || x == null ? undefined : Number(x));
  if ('age_years' in c) c.age_years = asNum(c.age_years);
  if ('weight_kg' in c) c.weight_kg = asNum(c.weight_kg);
  if ('height_cm' in c) c.height_cm = asNum(c.height_cm);
  if ('serum_creatinine' in c) c.serum_creatinine = asNum(c.serum_creatinine);

  // ensure strings for enums if present
  if (c.population_type) c.population_type = String(c.population_type);
  if (c.gender) c.gender = String(c.gender);
  if (c.indication) c.indication = String(c.indication);
  if (c.infection_severity) c.infection_severity = String(c.infection_severity);

  return c;
}

function formatError(err, fallback = 'Network error') {
  try {
    if (err?.response?.data?.detail) {
      const d = err.response.data.detail;
      if (typeof d === 'string') return d;
      if (Array.isArray(d)) {
        // FastAPI/Pydantic list of issues
        return d.map((x) => x?.msg || JSON.stringify(x)).join('; ');
      }
      return JSON.stringify(d);
    }
    if (err?.message) return err.message;
  } catch (_) {}
  return fallback;
}

// ---- endpoints ----
export async function bayesianOptimization(patient, levels, regimen) {
  try {
    const payload = { patient: normalizePatient(patient), levels: levels || [] };
    if (regimen && typeof regimen === 'object') payload.regimen = regimen; // optional regimen for exposure prediction
    const { data } = await api.post('/bayesian-optimization', payload);
    return { ...data, meta: { ...(data.meta || {}), source: 'bayesian' } };
  } catch (err) {
    const msg = formatError(err, 'Bayesian optimization failed');
    throw new Error(msg);
  }
}

// Align with backend /api/population-model expecting a PatientInput body (no wrapper)
export async function populationModelDose(patient) {
  try {
    const payload = normalizePatient(patient); // backend expects fields at root
    const { data } = await api.post('/population-model', payload);
    return { ...data, meta: { ...(data.meta || {}), source: 'population' } };
  } catch (err) {
    const msg = formatError(err, 'Population model calculation failed');
    throw new Error(msg);
  }
}

/**
 * Decide which endpoint to use based on levels.
 * If >=1 levels -> Bayesian; else -> Population fallback.
 */
export async function calculateDose(patient, levels) {
  const n = Array.isArray(levels) ? levels.length : 0;
  if (n > 0) return bayesianOptimization(patient, levels);
  return populationModelDose(patient);
}

/**
 * Interactive regimen update
 * - If levels present → re-run Bayesian with regimen
 * - If no levels → use population output and overlay regimen
 */
export async function interactiveUpdate(patient, levels, regimen) {
  if (!patient) throw new Error('No patient in context');
  const n = Array.isArray(levels) ? levels.length : 0;
  if (n > 0) return bayesianOptimization(patient, levels, regimen);
  const base = await populationModelDose(patient);
  if (regimen) {
    base.recommendation = base.recommendation || {};
    base.recommendation.regimen = regimen;
  }
  return base;
}