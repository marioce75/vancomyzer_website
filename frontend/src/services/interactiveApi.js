// Interactive AUC API client with availability probe and robust retries
// Uses Vite env var VITE_INTERACTIVE_API_URL as base. If missing, API is disabled.

// --- Base resolution with override ---
const QP_KEY = 'api';          // ?api=https://host[:port][/optionalPrefix]
const LS_BASE = 'apiBase';     // full base override (e.g., https://host[/prefix])
const LS_PREF = 'apiPrefix';   // detected prefix '', '/api'

function readMeta(name) {
  const el = typeof document !== 'undefined' ? document.querySelector(`meta[name="${name}"]`) : null;
  return el?.content?.trim() || '';
}

function readEnvBase() {
  // CRA then Vite
  const cra = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_INTERACTIVE_API_URL) || '';
  let vite = '';
  try { vite = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_INTERACTIVE_API_URL) || ''; } catch {}
  return cra || vite || readMeta('vancomyzer-api-base') || '';
}

function readBaseWithOverride() {
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
  return readEnvBase();
}

export const RAW_BASE = readBaseWithOverride(); // may be 'https://host' or 'https://host/api'
try { /* eslint-disable no-console */ console.debug('[Vancomyzer] RAW_BASE =', RAW_BASE || '(missing)'); } catch {}
export const API_BASE = RAW_BASE; // back-compat banner usage
export const __BASE__ = API_BASE; // back-compat debug logs

// Build a URL with a candidate prefix
function u(prefix, path) {
  const base = RAW_BASE?.replace(/\/+$/, '') || '';
  const pref = (prefix || '').replace(/\/?$/, ''); // '' or '/api'
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${pref}${p}`;
}

async function probePrefix() {
  // Cache hit?
  try {
    const cached = (typeof localStorage !== 'undefined') ? localStorage.getItem(LS_PREF) : null;
    if (cached === '' || cached === '/api') return cached;
  } catch {}

  // Try '' first, then '/api'
  for (const pref of ['', '/api']) {
    try {
      const res = await fetch(u(pref, '/health'), { mode: 'cors' });
      if (res.ok) {
        try { localStorage.setItem(LS_PREF, pref); } catch {}
        try { console.debug('[Vancomyzer] Detected API prefix =', pref || '(root)'); } catch {}
        return pref;
      }
    } catch { /* ignore and try next */ }
  }
  // Last resort: assume '/api' (old config) so UI can show error clearly
  try { localStorage.setItem(LS_PREF, '/api'); } catch {}
  return '/api';
}

let prefixPromise = null;
async function getPrefix() {
  if (prefixPromise) return prefixPromise;
  prefixPromise = probePrefix();
  return prefixPromise;
}

function jsonHeaders(extra) {
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(extra || {}) };
}

async function fetchJSON(url, init = {}) {
  const res = await fetch(url, { mode: 'cors', headers: jsonHeaders(init.headers), ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP_${res.status}`);
    err.status = res.status; err.body = text;
    throw err;
  }
  return res.json();
}

// --- Public API ---
export async function health() {
  if (!RAW_BASE) return false;
  try {
    const pref = await getPrefix();
    const ok = (await fetch(u(pref, '/health'), { mode: 'cors' })).ok;
    return !!ok;
  } catch { return false; }
}

export async function bayesAUC({ patient, regimen, levels = [] }, opts = {}) {
  if (!RAW_BASE) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const pref = await getPrefix();
  const url = u(pref, '/interactive/auc');
  try { console.debug('[Vancomyzer] POST', url, { patient, regimen, levels }); } catch {}
  return fetchJSON(url, { method: 'POST', body: JSON.stringify({ patient, regimen, levels }), ...opts });
}

export async function optimize({ patient, regimen, target }, opts = {}) {
  if (!RAW_BASE) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const pref = await getPrefix();
  const url = u(pref, '/optimize');
  try { console.debug('[Vancomyzer] POST', url, { patient, regimen, target }); } catch {}
  return fetchJSON(url, { method: 'POST', body: JSON.stringify({ patient, regimen, target }), ...opts });
}

// Back-compat utilities
export function clearApiDetection() {
  try { localStorage.removeItem(LS_PREF); localStorage.removeItem(LS_BASE); } catch {}
  try { console.debug('[Vancomyzer] Cleared API override/detected prefix'); } catch {}
}

// Back-compat (old imports)
export async function calculateInteractiveAUC(payload, opts) {
  return bayesAUC(payload, opts);
}

// Optional legacy endpoint used by some contexts
export async function pkSimulation(payload, opts = {}) {
  if (!RAW_BASE) throw new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
  const pref = await getPrefix();
  const url = u(pref, '/pk-simulation');
  return fetchJSON(url, { method: 'POST', body: JSON.stringify(payload || {}), ...opts });
}
