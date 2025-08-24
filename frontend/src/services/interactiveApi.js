// Interactive AUC API client using canonical /api prefix
// - Base: import.meta.env.VITE_API_BASE (no trailing slash)
// - Endpoints: POST /api/interactive/auc, POST /api/optimize, GET /api/health

const LS_BASE = 'apiBase'; // optional runtime override via localStorage

function trimSlash(s) { return (s || '').replace(/\/+$/, ''); }

function readEnvBase() {
  try { return trimSlash(import.meta?.env?.VITE_API_BASE || ''); } catch { return ''; }
}

function getRawBase() {
  // Priority: ?api=, localStorage, env
  try {
    const url = (typeof window !== 'undefined' && window.location) ? new URL(window.location.href) : null;
    const qp = url ? url.searchParams.get('api') : '';
    if (qp) {
      try { localStorage.setItem(LS_BASE, qp); } catch {}
      return trimSlash(qp);
    }
  } catch {}
  try { const ls = localStorage.getItem(LS_BASE); if (ls) return trimSlash(ls); } catch {}
  return readEnvBase();
}

let __base = null;
export async function getApiBase() {
  if (__base) return __base;
  __base = getRawBase();
  if (!__base) {
    try { console.warn('[Vancomyzer] Missing VITE_API_BASE; set it in .env'); } catch {}
  }
  return __base;
}

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

// Generic POST helper with one transient retry
async function postJSON(path, body, opts = {}) {
  const base = await getApiBase();
  if (!base) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const url = `${base}${path}`;
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
  const base = await getApiBase();
  if (!base) return false;
  try { return (await fetch(`${base}/api/health`, { mode: 'cors' })).ok; } catch { return false; }
}

export async function bayesAUC({ patient, regimen, levels = [] }, opts = {}) {
  return postJSON('/api/interactive/auc', { patient, regimen, levels }, opts);
}

export async function optimize({ patient, regimen, target }, opts = {}) {
  return postJSON('/api/optimize', { patient, regimen, target }, opts);
}

export function clearApiDetection() {
  try { localStorage.removeItem(LS_BASE); } catch {}
  try { console.debug('[Vancomyzer] Cleared API override'); } catch {}
}

// Back-compat aliases used in some app modules
export async function calculateInteractiveAUC(payload, opts = {}) {
  return bayesAUC(payload, opts);
}

export async function pkSimulation(payload, opts = {}) {
  const base = await getApiBase();
  if (!base) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const url = `${base}/api/pk-simulation`;
  return fetchJSON(url, { method: 'POST', body: JSON.stringify(payload || {}), ...opts });
}

// Debug export of base (raw, not including /api)
export const API_BASE = getRawBase();
export const __BASE__ = API_BASE;
