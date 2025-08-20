// Interactive AUC API client with availability probe and robust retries
// Uses Vite env var VITE_INTERACTIVE_API_URL as base. If missing, API is disabled.

// --- Base resolution with override ---
function readMeta(name) {
  try {
    const el = typeof document !== 'undefined' ? document.querySelector(`meta[name="${name}"]`) : null;
    return (el?.content || '').trim();
  } catch { return ''; }
}

function computeBase() {
  // URL override ?api=...
  try {
    if (typeof window !== 'undefined' && window.location) {
      const url = new URL(window.location.href);
      const qp = url.searchParams.get('api');
      if (qp) {
        try { localStorage.setItem('apiBase', qp); } catch {}
        return qp;
      }
    }
  } catch {}
  // Persisted override
  try {
    const ls = typeof localStorage !== 'undefined' ? localStorage.getItem('apiBase') : '';
    if (ls) return ls;
  } catch {}
  // Build-time env (CRA) FIRST
  try {
    const fromCra = (typeof process !== 'undefined' && process.env) ? (process.env.REACT_APP_INTERACTIVE_API_URL || '') : '';
    if (fromCra) return fromCra;
  } catch {}
  // Build-time env (Vite) SECOND
  try {
    const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_INTERACTIVE_API_URL || '') : '';
    if (fromVite) return fromVite;
  } catch {}
  // Meta fallback from index.html
  const fromMetaRaw = readMeta('vancomyzer-api-base');
  const fromMeta = (fromMetaRaw && !/^%.*%$/.test(fromMetaRaw)) ? fromMetaRaw : '';
  return fromMeta || '';
}

export const API_BASE = computeBase();
export const __BASE__ = API_BASE; // back-compat

// One-time diagnostics
(function logBaseOnce() {
  try { /* eslint-disable no-console */ console.debug('[Vancomyzer] API base =', API_BASE || '(missing)'); } catch {}
  if (API_BASE && !API_BASE.endsWith('/api')) {
    try { console.warn('[Vancomyzer] API base should end with /api. Current:', API_BASE); } catch {}
  }
})();

export function clearApiOverride() {
  try { localStorage.removeItem('apiBase'); } catch {}
}

const BACKOFF_MS = [250, 500, 1000];
const REQUEST_TIMEOUT_MS = 6000;
const HEALTH_TIMEOUT_MS = 2000;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function buildHeaders(extra) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
}

function is4xx(status) {
  return status >= 400 && status < 500;
}

async function fetchWithRetry(url, opts = {}, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), REQUEST_TIMEOUT_MS);

    // If caller provided a signal, link it so either aborts the request
    let abortHandler;
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timeout);
        const err = new DOMException('Aborted', 'AbortError');
        throw err;
      }
      abortHandler = () => {
        controller.abort(opts.signal.reason || new DOMException('Aborted', 'AbortError'));
      };
      try { opts.signal.addEventListener('abort', abortHandler, { once: true }); } catch {}
    }

    try {
      const res = await fetch(url, {
        mode: 'cors',
        ...opts,
        headers: buildHeaders(opts.headers),
        // Always use our controller to preserve timeout; caller abort is linked above
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        // Do not retry on 4xx
        if (is4xx(res.status)) {
          const err = new Error(`Bad response: ${res.status}`);
          err.name = 'INTERACTIVE_BAD_RESPONSE';
          err.status = res.status;
          try { err.body = await res.text(); } catch {}
          throw err;
        }
        // Retry on 5xx unless last attempt
        if (i < attempts - 1) {
          await sleep(BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]);
          continue;
        }
        const err = new Error(`Bad response: ${res.status}`);
        err.name = 'INTERACTIVE_BAD_RESPONSE';
        err.status = res.status;
        try { err.body = await res.text(); } catch {}
        throw err;
      }
      return res;
    } catch (e) {
      clearTimeout(timeout);
      lastError = e;
      // If aborted (user interaction), do not retry; surface abort to caller
      if (e?.name === 'AbortError') {
        throw e;
      }
      // Only retry network/timeout; otherwise final attempt throws below
      if (i === attempts - 1) {
        const err = new Error('Interactive endpoint unavailable');
        err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE';
        err.cause = e;
        throw err;
      }
      await sleep(BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]);
      continue;
    } finally {
      // Best effort to remove listener (optional since once: true is used)
      if (opts.signal && abortHandler) {
        try { opts.signal.removeEventListener('abort', abortHandler); } catch {}
      }
    }
  }
  const err = new Error('Interactive endpoint unavailable');
  err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE';
  err.cause = lastError;
  throw err;
}

// --- Public API ---
export async function health() {
  if (!API_BASE) return false; // disabled by config
  const url = `${API_BASE}/health`;
  try { console.debug('[Vancomyzer] GET', url); } catch {}
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: buildHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return !!res.ok;
  } catch (e) {
    clearTimeout(timeout);
    try { console.warn('[Vancomyzer] health error:', e?.message || e); } catch {}
    return false;
  }
}

export async function bayesAUC({ patient, regimen, levels = [] }, { signal } = {}) {
  if (!API_BASE) {
    const err = new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
    err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE';
    throw err;
  }
  const url = `${API_BASE}/interactive/auc`;
  const payload = { patient, regimen, levels: Array.isArray(levels) ? levels : [] };
  try {
    console.debug('[Vancomyzer] POST', url, {
      shape: {
        patient: patient ? Object.keys(patient) : null,
        regimen: regimen ? Object.keys(regimen) : null,
        levels: Array.isArray(levels) ? levels.length : null,
      }
    });
  } catch {}
  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    }, 3);
    return res.json();
  } catch (e) {
    try {
      const msg = e?.message || String(e);
      const status = e?.status;
      console.warn('[Vancomyzer] bayesAUC error:', msg, status ? `(status: ${status})` : '', e?.body ? `body: ${String(e.body).slice(0, 200)}` : '');
    } catch {}
    throw e;
  }
}

export async function optimize({ patient, regimen, target }, { signal } = {}) {
  if (!API_BASE) {
    const err = new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
    err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE';
    throw err;
  }
  const url = `${API_BASE}/optimize`;
  const payload = { patient, regimen, target: target ?? {} };
  try {
    console.debug('[Vancomyzer] POST', url, {
      shape: {
        patient: patient ? Object.keys(patient) : null,
        regimen: regimen ? Object.keys(regimen) : null,
        target: target ? Object.keys(target) : null,
      }
    });
  } catch {}
  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    }, 3);
    return res.json();
  } catch (e) {
    try {
      const msg = e?.message || String(e);
      const status = e?.status;
      console.warn('[Vancomyzer] optimize error:', msg, status ? `(status: ${status})` : '', e?.body ? `body: ${String(e.body).slice(0, 200)}` : '');
    } catch {}
    throw e;
  }
}

export async function pkSimulation(payload, { signal } = {}) {
  if (!API_BASE) {
    const err = new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE');
    err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE';
    throw err;
  }
  const res = await fetchWithRetry(`${API_BASE}/pk-simulation`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    signal,
  }, 3);
  return res.json();
}

// Back-compat (old imports)
export async function calculateInteractiveAUC(payload, opts) {
  return bayesAUC(payload, opts);
}
export async function optimizeDose(payload, opts) {
  return optimize(payload, opts);
}
