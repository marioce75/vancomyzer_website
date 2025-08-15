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

export async function submitDosing({ patient, levels = [] }) {
  // Smart wrapper: if levels provided -> Bayesian; else -> population
  if (Array.isArray(levels) && levels.length > 0) {
    return bayesianOptimization({ patient, levels });
  }
  return calculateDosing(patient);
}

export async function calculateDosing(patient) {
  return jsonFetch("/calculate-dosing", { body: { patient } });
}

export async function bayesianOptimization({ patient, levels }) {
  return jsonFetch("/bayesian-optimization", { body: { patient, levels } });
}

export async function pkSimulation(payload) {
  return jsonFetch("/pk-simulation", { body: payload });
}
