import { normalizePatientFields } from './services/normalizePatient';
import { apiPath, API_BASE } from './lib/apiBase';

let __loggedBase = false;
function debug(...args) { if (import.meta?.env?.DEV) console.debug('[API]', ...args); }
if (!__loggedBase) { __loggedBase = true; debug('BASE', API_BASE || '(empty)'); }

const REQUEST_TIMEOUT_MS = 6000;
const RETRIES = 3;
const BACKOFF_MS = [250, 500, 1000];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function jsonFetch(path, { method = 'POST', body, signal } = {}) {
  const url = path.startsWith('http') ? path : apiPath(path);
  debug('fetch', url);

  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), REQUEST_TIMEOUT_MS);

    let abortHandler;
    if (signal) {
      if (signal.aborted) { clearTimeout(timeout); throw signal.reason || new DOMException('Aborted', 'AbortError'); }
      abortHandler = () => controller.abort(signal.reason || new DOMException('Aborted', 'AbortError'));
      try { signal.addEventListener('abort', abortHandler, { once: true }); } catch {}
    }

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', mode: 'cors', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          let msg = `${res.status} ${res.statusText}`; try { const err = await res.json(); if (err?.detail) msg = Array.isArray(err.detail) ? JSON.stringify(err.detail) : String(err.detail); } catch {}
          const e = new Error(msg); e.status = res.status; e.name = 'INTERACTIVE_BAD_RESPONSE'; throw e;
        }
        if (attempt < RETRIES - 1) { await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]); continue; }
        let msg = `${res.status} ${res.statusText}`; try { const err = await res.json(); if (err?.detail) msg = Array.isArray(err.detail) ? JSON.stringify(err.detail) : String(err.detail); } catch {}
        const e = new Error(msg); e.status = res.status; e.name = 'INTERACTIVE_BAD_RESPONSE'; throw e;
      }
      return res.json();
    } catch (e) {
      clearTimeout(timeout); lastError = e; if (e?.name === 'AbortError') throw e; if (attempt === RETRIES - 1) { const err = new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE'); err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE'; err.cause = e; throw err; } await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    } finally {
      if (signal && abortHandler) { try { signal.removeEventListener('abort', abortHandler); } catch {} }
    }
  }
  const err = new Error('INTERACTIVE_ENDPOINT_UNAVAILABLE'); err.name = 'INTERACTIVE_ENDPOINT_UNAVAILABLE'; err.cause = lastError; throw err;
}

// --- Health probe ---
export async function health({ signal } = {}) { return jsonFetch('/api/health', { method: 'GET', signal }); }

function ensureNestedPatient(patientLike) { const norm = normalizePatientFields(patientLike ?? {}); return norm; }

export async function calculateInteractiveAUC({ patient, regimen, levels = [] }, { signal } = {}) {
  const payload = { patient: ensureNestedPatient(patient), regimen: regimen ?? {}, levels: Array.isArray(levels) ? levels : [] };
  return jsonFetch('/api/interactive/auc', { method: 'POST', body: payload, signal }); }

export async function optimizeDose({ patient, regimen, target }, { signal } = {}) {
  const payload = { patient: ensureNestedPatient(patient), regimen: regimen ?? {}, target: target ?? {} };
  return jsonFetch('/api/optimize', { method: 'POST', body: payload, signal }); }

export async function pkSimulation(payload) { return jsonFetch('/api/pk-simulation', { method: 'POST', body: payload }); }
