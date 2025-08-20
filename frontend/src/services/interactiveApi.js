// Interactive AUC API client with availability probe and robust base resolution
// Fixes 405s caused by double "/api" and makes the client robust

// Keys
const QP_KEY = 'api';                 // ?api=https://host[:port][/optionalPrefix]
const LS_BASE = 'apiBase';            // full base override (e.g., https://host[/prefix])
const LS_RESOLVED = 'apiResolved';    // final base (no trailing slash), e.g. https://host or https://host/api

function readMeta(name) {
  try {
    const el = typeof document !== 'undefined' ? document.querySelector(`meta[name="${name}"]`) : null;
    return el?.content?.trim() || '';
  } catch { return ''; }
}

function readEnv() {
  const cra = (typeof process !== 'undefined' && process.env?.REACT_APP_INTERACTIVE_API_URL) || '';
  let vite = '';
  try { vite = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INTERACTIVE_API_URL) || ''; } catch {}
  return cra || vite || readMeta('vancomyzer-api-base') || '';
}

// 1) Get RAW base (may include /api), honoring query param and localStorage override
function getRawBase() {
  try {
    const url = (typeof window !== 'undefined' && window.location) ? new URL(window.location.href) : null;
    const qp = url ? url.searchParams.get(QP_KEY) : '';
    if (qp) {
      try { localStorage.setItem(LS_BASE, qp); } catch {}
      return qp;
    }
  } catch {}
  try {
    const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem(LS_BASE) : '';
    if (ls) return ls;
  } catch {}
  return readEnv();
}

// 2) Normalize trailing slashes
function trimSlash(s) { return (s || '').replace(/\/+$/, ''); }

// 3) Resolve final base by probing endpoints and caching in localStorage
async function resolveBase() {
  try { const cached = (typeof localStorage !== 'undefined') ? localStorage.getItem(LS_RESOLVED) : ''; if (cached) return cached; } catch {}

  const raw = trimSlash(getRawBase());
  if (!raw) { try { console.warn('[Vancomyzer] API base missing'); } catch {} return ''; }

  const rawHasApi = /\/api$/.test(raw);
  const candidates = [ `${raw}/health` ];
  if (!rawHasApi) candidates.push(`${raw}/api/health`);

  for (const url of candidates) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const resolved = url.replace(/\/health$/, '');
        try { localStorage.setItem(LS_RESOLVED, resolved); } catch {}
        try { console.debug('[Vancomyzer] Resolved API base =', resolved); } catch {}
        return resolved;
      }
    } catch { /* try next */ }
  }

  // Fallback: if RAW has /api keep it, else append /api for clearer errors
  const fallback = rawHasApi ? raw : `${raw}/api`;
  try { localStorage.setItem(LS_RESOLVED, fallback); } catch {}
  try { console.warn('[Vancomyzer] Using fallback API base =', fallback); } catch {}
  return fallback;
}

let basePromise = null;
export async function getApiBase() {
  if (!basePromise) basePromise = resolveBase();
  return basePromise;
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

// Public API
export async function health() {
  const base = await getApiBase();
  if (!base) return false;
  try { return (await fetch(`${base}/health`, { mode: 'cors' })).ok; } catch { return false; }
}

export async function bayesAUC({ patient, regimen, levels = [] }, opts = {}) {
  const base = await getApiBase();
  if (!base) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const url = `${base}/interactive/auc`;
  try { console.debug('[Vancomyzer] POST', url, { patient, regimen, levels }); } catch {}
  return fetchJSON(url, { method: 'POST', body: JSON.stringify({ patient, regimen, levels }), ...opts });
}

export async function optimize({ patient, regimen, target }, opts = {}) {
  const base = await getApiBase();
  if (!base) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const url = `${base}/optimize`;
  try { console.debug('[Vancomyzer] POST', url, { patient, regimen, target }); } catch {}
  return fetchJSON(url, { method: 'POST', body: JSON.stringify({ patient, regimen, target }), ...opts });
}

// Back-compat utilities and exports
export function clearApiDetection() {
  try { localStorage.removeItem(LS_RESOLVED); localStorage.removeItem(LS_BASE); } catch {}
  try { console.debug('[Vancomyzer] Cleared API detection/override'); } catch {}
}

// Old alias used elsewhere
export async function calculateInteractiveAUC(payload, opts) { return bayesAUC(payload, opts); }

// Optional legacy endpoint used by some contexts
export async function pkSimulation(payload, opts = {}) {
  const base = await getApiBase();
  if (!base) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const url = `${base}/pk-simulation`;
  return fetchJSON(url, { method: 'POST', body: JSON.stringify(payload || {}), ...opts });
}

// Back-compat banner/debug values (use raw, not resolved; resolved is async)
const RAW_BASE = trimSlash(getRawBase());
try { /* eslint-disable no-console */ console.debug('[Vancomyzer] RAW_BASE =', RAW_BASE || '(missing)'); } catch {}
export const API_BASE = RAW_BASE;
export const __BASE__ = API_BASE;
