// Interactive AUC API client using canonical /api prefix
// Endpoints: POST /api/interactive/auc and GET /api/health

import { apiPath } from '../lib/apiBase';

export async function health() {
  const url = apiPath('/health');
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(`Health check failed: HTTP ${r.status}`);
  return r.json().catch(() => ({}));
}

export async function postAuc(payload) {
  const url = apiPath('/interactive/auc');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) {
    const reason = data?.detail || r.statusText || `HTTP ${r.status}`;
    throw new Error(`AUC request failed: ${reason}`);
  }
  return data;
}

// Back-compat: accept nested payload and convert to flat AucRequest
export async function calculateInteractiveAUC({ patient = {}, regimen = {}, levels = [] } = {}, opts = {}) {
  const flat = {
    age_years: patient.age_years ?? patient.age ?? null,
    weight_kg: patient.weight_kg ?? null,
    height_cm: patient.height_cm ?? null,
    scr_mg_dl: patient.scr_mg_dl ?? patient.serum_creatinine_mg_dl ?? patient.serum_creatinine ?? null,
    gender: patient.gender ?? null,
    dose_mg: regimen.dose_mg ?? null,
    interval_hr: regimen.interval_hours ?? null,
    infusion_minutes: regimen.infusion_minutes ?? 60,
    levels: Array.isArray(levels)
      ? levels.map((v) => (typeof v === 'number' ? v : (v?.concentration_mg_L ?? v?.conc ?? null))).filter((x) => x != null)
      : null,
  };
  return postAuc(flat, opts);
}

// Optional: best-effort optimize; resolves to {} on failure
export async function optimize({ patient, regimen, target }, opts = {}) {
  const url = apiPath('/optimize');
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient, regimen, target } || {}), ...(opts || {}) });
    if (!r.ok) return {};
    return r.json().catch(() => ({}));
  } catch {
    return {};
  }
}

export async function pkSimulation(payload, opts = {}) {
  const url = apiPath('/pk-simulation');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}), ...(opts || {}) });
  if (!r.ok) throw new Error(`pk-simulation failed: HTTP ${r.status}`);
  return r.json();
}
