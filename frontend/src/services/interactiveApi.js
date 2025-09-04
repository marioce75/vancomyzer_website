// Interactive AUC API client using canonical /api prefix
// Endpoints: POST /api/interactive/auc, POST /api/optimize, GET /api/health

import { apiPath, checkHealth } from '../lib/apiBase';

function jsonHeaders(h) { return { 'Content-Type': 'application/json', Accept: 'application/json', ...(h || {}) }; }

async function fetchJSON(url, init = {}) {
  const res = await fetch(url, { mode: 'cors', headers: jsonHeaders(init.headers), ...init });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`HTTP_${res.status}`);
    err.status = res.status; err.url = url; err.body = body;
    try { console.warn('[Vancomyzer] Request failed', err.status, url, body); } catch {}
    throw err;
  }
  return res.json();
}

// Kick off a non-blocking health probe at startup
try { checkHealth(); } catch {}

// Generic POST helper with one transient retry
async function postJSON(path, body, opts = {}) {
  const url = apiPath(path);
  try { return await fetchJSON(url, { method: 'POST', body: JSON.stringify(body), ...opts }); }
  catch (e) {
    const transient = (e && (e.status === 502 || e.status === 503 || e.status === 504)) || (e && e.name === 'TypeError');
    if (transient) {
      await new Promise(r => setTimeout(r, 350));
      return fetchJSON(url, { method: 'POST', body: JSON.stringify(body), ...opts });
    }
    throw e;
  }
}

// Public API
export async function health() {
  try {
    const res = await checkHealth();
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function bayesAUC({ patient, regimen, levels = [] }, opts = {}) {
  return postJSON('/interactive/auc', { patient, regimen, levels }, opts);
}

export async function optimize({ patient, regimen, target }, opts = {}) {
  return postJSON('/optimize', { patient, regimen, target }, opts);
}

export async function pkSimulation(payload, opts = {}) {
  return fetchJSON(apiPath('/pk-simulation'), { method: 'POST', body: JSON.stringify(payload || {}), ...opts });
}

// Back-compat aliases used in some app modules
export async function calculateInteractiveAUC(payload, opts = {}) { return bayesAUC(payload, opts); }

// Debug export of base
export { API_BASE } from '../lib/apiBase';
export { API_BASE as __BASE__ } from '../lib/apiBase';
