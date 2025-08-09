const API_BASE = process.env.REACT_APP_API_BASE || '';

async function getHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

async function postJSON(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const detail = body && (body.detail || body.message);
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return body;
}

// Update calculateDosing to include gender normalization and validation
export function calculateDosing(payload) {
  // Normalize gender and severity
  payload.gender = (payload.gender ?? payload.sex)?.toLowerCase().trim();
  payload.severity = payload.severity?.toLowerCase().trim();

  // Pre-submit guard for gender
  if (!payload.gender) {
    throw new Error('Gender is required and must be either "male" or "female".');
  }

  // Coerce numeric fields
  ['age_years', 'weight_kg', 'height_cm', 'serum_creatinine'].forEach((key) => {
    if (payload[key] !== undefined) {
      payload[key] = Number(payload[key]);
    }
  });

  return postJSON('/api/calculate-dosing', payload);
}

export function bayesianOptimization(payload) {
  return postJSON('/api/bayesian-optimization', payload);
}

export function pkSimulation(payload) {
  return postJSON('/api/pk-simulation', payload);
}

export { getHealth, API_BASE };
