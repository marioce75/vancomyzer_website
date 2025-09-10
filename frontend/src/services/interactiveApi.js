// Interactive AUC API service using self-healing discovery layer

import { apiPath, ensureHealthy } from '../lib/apiDiscovery';

// Robust fetch wrapper that handles network failures and auto-recovery
async function robustFetch(url, options) {
  try {
    const response = await fetch(url, options);
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.json(),
      text: async () => response.text(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0, // Network failure
      json: async () => ({}),
      text: async () => error?.toString() || 'Network error',
    };
  }
}

// Health check
export async function health() {
  try {
    await ensureHealthy();
    return true;
  } catch (error) {
    console.warn('[Vancomyzer] Health check failed:', error);
    return false;
  }
}

// Updated AUC request to use `/api/interactive/auc` and log requests/responses
export async function postAuc(payload) {
  const url = apiPath('/interactive/auc');
  console.log('[Vancomyzer] Sending AUC request to:', url, 'with payload:', payload);

  const response = await robustFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('[Vancomyzer] Received response:', response);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Vancomyzer] AUC request failed:', errorText);
    throw new Error(`AUC request failed: ${errorText}`);
  }

  return response.json();
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
  return postAuc(flat);
}

// Legacy export expected by pages: returns an object with { metrics, series, ... }
export async function bayesAUC(payload, opts = {}) {
  const res = await calculateInteractiveAUC(payload, opts);
  const body = res?.result ?? res ?? {};
  const hasMetrics = body && typeof body === 'object' && 'metrics' in body;
  if (hasMetrics) return body; // already normalized
  const normalized = { ...body };
  if (!normalized.metrics) {
    normalized.metrics = {
      auc_24: body?.auc_24 ?? null,
      predicted_peak: body?.predicted_peak ?? null,
      predicted_trough: body?.predicted_trough ?? null,
    };
  }
  return normalized;
}

// Optional: best-effort optimize; resolves to {} on failure
export async function optimize({ patient, regimen, target }, opts = {}) {
  try {
    const url = apiPath('/optimize');
    const response = await robustFetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ patient, regimen, target }),
      ...opts
    });
    
    if (!response.ok) return {};
    return response.json();
  } catch {
    return {};
  }
}

export async function pkSimulation(payload, opts = {}) {
  const url = apiPath('/pk-simulation');
  const response = await robustFetch(url, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(payload || {}), 
    ...opts 
  });
  
  if (!response.ok) {
    throw new Error(`pk-simulation failed: HTTP ${response.status}`);
  }
  
  return response.json();
}
