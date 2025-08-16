import { normalizePatientFields } from './services/normalizePatient';

const API_BASE = "https://vancomyzer.onrender.com/api";

async function jsonFetch(path, { method = "POST", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      if (err?.detail) msg = Array.isArray(err.detail) ? JSON.stringify(err.detail) : String(err.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function assertFlatPayload(payload) {
  if (payload && typeof payload === 'object' && 'patient' in payload) {
    throw new Error('Payload must be flat. Do not wrap in { patient: ... }.');
  }
  const required = ['population_type', 'gender', 'weight_kg', 'serum_creatinine'];
  for (const k of required) {
    if (payload[k] === undefined) {
      throw new Error(`Missing required field: ${k}`);
    }
  }
}

export async function submitDosing({ patient, levels = [] }) {
  // Backward compatibility: callers may pass either a flat object or { patient }
  const base = normalizePatientFields(patient ?? {});
  const payload = { ...base, levels: Array.isArray(levels) ? levels : [] };
  assertFlatPayload(payload);
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[DosingAPI] payload (submitDosing)', payload);
  }
  // If levels -> bayesian, else -> population
  if (payload.levels.length > 0) return jsonFetch('/bayesian-optimization', { body: payload });
  return jsonFetch('/calculate-dosing', { body: payload });
}

export async function calculateDosing(patientLike) {
  const payload = normalizePatientFields(patientLike ?? {});
  assertFlatPayload(payload);
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[DosingAPI] payload (calculateDosing)', payload);
  }
  return jsonFetch("/calculate-dosing", { body: payload });
}

export async function bayesianOptimization({ patient, levels }) {
  const base = normalizePatientFields(patient ?? {});
  const payload = { ...base, levels: Array.isArray(levels) ? levels : [] };
  assertFlatPayload(payload);
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[DosingAPI] payload (bayesianOptimization)', payload);
  }
  // Server accepts flat payload via compatibility wrapper
  return jsonFetch("/bayesian-optimization", { body: payload });
}

export async function pkSimulation(payload) {
  // pk-simulation expects nested { patient, dose, interval }
  return jsonFetch("/pk-simulation", { body: payload });
}
