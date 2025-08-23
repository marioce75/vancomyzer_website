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
  const craInteractive = (typeof process !== 'undefined' && process.env?.REACT_APP_INTERACTIVE_API_URL) || '';
  const craGeneric = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || '';
  let vite = '';
  try { vite = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_INTERACTIVE_API_URL || import.meta.env?.VITE_API_BASE || '')) || ''; } catch {}
  return craInteractive || craGeneric || vite || readMeta('vancomyzer-api-base') || '';
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

// 3) Resolve final base; prefer "/api" variant when available
async function resolveBase() {
  try { const cached = (typeof localStorage !== 'undefined') ? localStorage.getItem(LS_RESOLVED) : ''; if (cached) return cached; } catch {}

  const raw = trimSlash(getRawBase());
  if (!raw) { try { console.warn('[Vancomyzer] API base missing'); } catch {} return ''; }

  const hasApi = /\/api$/.test(raw);
  const candidates = hasApi
    ? [ { url: `${raw}/health`, base: raw } ]
    : [ { url: `${raw}/api/health`, base: `${raw}/api` }, { url: `${raw}/health`, base: raw } ];

  for (const c of candidates) {
    try {
      const res = await fetch(c.url, { mode: 'cors' });
      if (res.ok) {
        try { localStorage.setItem(LS_RESOLVED, c.base); } catch {}
        try { console.debug('[Vancomyzer] Resolved API base =', c.base); } catch {}
        return c.base;
      }
    } catch { /* try next */ }
  }

  // Fallback to prefer /api variant
  const fallback = hasApi ? raw : `${raw}/api`;
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

// New: POST helper with 405 fallback and one transient retry
async function postWithFallback(path, body, opts = {}) {
  const base = await getApiBase();
  if (!base) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const primary = `${base}${path}`;
  const doPost = (u) => fetchJSON(u, { method: 'POST', body: JSON.stringify(body), ...opts });

  try {
    return await doPost(primary);
  } catch (e) {
    // Retry once for transient errors
    const transient = (e && (e.status === 502 || e.status === 503 || e.status === 504)) || (e && e.name === 'TypeError');
    if (transient) {
      await new Promise(r => setTimeout(r, 350));
      try { return await doPost(primary); } catch (_) { /* fall through */ }
    }
    if (e && e.status === 405) {
      const altBase = base.endsWith('/api') ? base.replace(/\/api$/, '') : `${base}/api`;
      const alt = `${altBase}${path}`;
      try { console.debug('[Vancomyzer] 405 retry ->', alt); } catch {}
      const result = await doPost(alt);
      try { localStorage.setItem(LS_RESOLVED, altBase); } catch {}
      return result;
    }
    throw e;
  }
}

// Public API
export async function health() {
  const base = await getApiBase();
  if (!base) return false;
  try { return (await fetch(`${base}/health`, { mode: 'cors' })).ok; } catch { return false; }
}

export async function bayesAUC({ patient, regimen, levels = [] }, opts = {}) {
  // Canonical path (backend mounted under "/api"); resolveBase prefers base with "/api"
  return postWithFallback('/interactive/auc', { patient, regimen, levels }, opts);
}

export async function optimize({ patient, regimen, target }, opts = {}) {
  return postWithFallback('/optimize', { patient, regimen, target }, opts);
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
