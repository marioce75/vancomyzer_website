import { normalizePatientFields } from './normalizePatient';

// Force CRA to embed the production API base if provided via env
const BUILD_API_BASE = (typeof process !== 'undefined' && process.env) ? process.env.REACT_APP_API_BASE : undefined;

const CANDIDATE_ENDPOINTS = [
  { path: '/api/dose/interactive', methods: ['POST'] },
  { path: '/api/interactive',       methods: ['POST'] },
  { path: '/api/dose/adjust',       methods: ['POST'] }
];

function getApiBase() {
  // Safe access to env across CRA/Vite without using import.meta (which breaks in non-ESM)
  const env = (typeof process !== 'undefined' && process?.env) ? process.env : {};
  const w = (typeof window !== 'undefined') ? window : {};
  return (
    w.VANCOMYZER_API_BASE_URL ||
    w.VITE_API_BASE ||
    w.REACT_APP_API_BASE ||
    BUILD_API_BASE ||
    env.VITE_API_BASE ||
    env.REACT_APP_API_BASE ||
    '' // same-origin by default
  );
}

async function tryOptions(url) {
  try {
    const r = await fetch(url, { method: 'OPTIONS' });
    const allow = r.headers.get('Allow') || '';
    return allow.split(',').map((s) => s.trim().toUpperCase());
  } catch {
    return [];
  }
}

// Tries multiple (path,method) combos until one works (status < 400 and not 405/404)
export async function calculateInteractiveAUC(patient, regimen) {
  const base = getApiBase();
  const normalized = normalizePatientFields(patient);
  const body = {
    ...normalized,
    // Send levels as-is; caller should already compute exact time_hr positions in first interval only
    levels: Array.isArray(patient?.levels) ? patient.levels : [],
    regimen, // { dose_mg, interval_hours, infusion_minutes }
    mic_mg_L: Number(normalized?.mic_mg_L) || 1.0,
  };

  // Dev-only payload check
  if (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[InteractiveAUC] payload', body);
  }

  let lastError;
  for (const cand of CANDIDATE_ENDPOINTS) {
    const url = base + cand.path;

    // If OPTIONS responds with Allow, filter to allowed methods first
    const allowed = await tryOptions(url);
    const methods = allowed.length ? cand.methods.filter((m) => allowed.includes(m)) : cand.methods;

    for (const method of methods) {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.status === 405 || res.status === 404) {
          lastError = new Error(`${res.status} on ${method} ${cand.path}`);
          continue; // try next candidate
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          const err = new Error(`Interactive ${res.status}: ${detail}`);
          err.cause = new Error(`${res.status} on ${method} ${cand.path}`);
          throw err;
        }
        const data = await res.json();
        // Normalize to a common shape expected by consumers
        if (data?.series && Array.isArray(data.series.time_hours)) {
          const series = data.series;
          // Map median/p05/p95 to concentration_mg_L/lower/upper if needed
          const concentration_mg_L = Array.isArray(series.concentration_mg_L) ? series.concentration_mg_L
            : Array.isArray(series.median) ? series.median : [];
          const lower = Array.isArray(series.lower) ? series.lower : (Array.isArray(series.p05) ? series.p05 : undefined);
          const upper = Array.isArray(series.upper) ? series.upper : (Array.isArray(series.p95) ? series.p95 : undefined);
          const metrics = data.metrics || {
            auc_24: data.auc_24,
            predicted_peak: data.predicted_peak,
            predicted_trough: data.predicted_trough,
            auc24_over_mic: data.auc24_over_mic,
          };
          return {
            series: { time_hours: series.time_hours, concentration_mg_L, lower, upper },
            metrics,
            posterior: data.posterior,
            diagnostics: data.diagnostics,
          };
        }
        if (Array.isArray(data?.time_hours) && Array.isArray(data?.concentration_mg_L)) {
          return { series: { time_hours: data.time_hours, concentration_mg_L: data.concentration_mg_L } };
        }
        return data;
      } catch (e) {
        lastError = e?.cause || e;
        // try next method/path
      }
    }
  }

  // If we reach here, no server interactive endpoint worked.
  const err = new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  err.cause = lastError;
  throw err;
}
