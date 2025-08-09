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

export function calculateDosing(payload) {
  return postJSON('/api/calculate-dosing', payload);
}

export function bayesianOptimization(payload) {
  return postJSON('/api/bayesian-optimization', payload);
}

export function pkSimulation(payload) {
  return postJSON('/api/pk-simulation', payload);
}

export { getHealth, API_BASE };
