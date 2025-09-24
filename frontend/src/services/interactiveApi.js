// Interactive AUC API service using self-healing discovery layer

import { apiPath, ensureHealthy, joinUrl, discoverApiBase } from '../lib/apiDiscovery';

// Resolve BASE from env for direct calls; discovery layer still available
function getBase() {
  const env = process.env.REACT_APP_INTERACTIVE_API_URL || process.env.VITE_INTERACTIVE_API_URL || process.env.REACT_APP_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '';
  return String(env || '').replace(/\/$/, '');
}

// Remove null/undefined/NaN from payload to reduce backend validation noise
function sanitizePayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

// Small sleep helper (abort-aware)
function delay(ms, signal) {
  return new Promise((resolve) => {
    if (!ms || ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) { clearTimeout(t); return resolve(); }
      const onAbort = () => { clearTimeout(t); resolve(); };
      signal.addEventListener?.('abort', onAbort, { once: true });
    }
  });
}

// Robust fetch wrapper that handles network failures, timeout, and auto-recovery
async function robustFetch(url, options) {
  const { timeoutMs = 15000, signal: extSignal, headers, ...rest } = options || {};
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (extSignal) {
    if (extSignal.aborted) controller.abort();
    else extSignal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      ...rest,
      headers: { Accept: 'application/json', ...(headers || {}) },
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      json: async () => {
        try { return await response.json(); } catch { return {}; }
      },
      text: async () => {
        try { return await response.text(); } catch (e) { return e?.toString?.() || 'Network error'; }
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 0, // Network failure / aborted / timeout
      headers: new Headers(),
      json: async () => ({}),
      text: async () => error?.toString() || 'Network error',
    };
  } finally {
    if (timer) clearTimeout(timer);
    if (extSignal) extSignal.removeEventListener?.('abort', onAbort);
  }
}

// Generic retry wrapper (idempotent POST expected by backend). Defaults to no retries unless specified in opts.
async function fetchJsonWithRetry(url, options = {}, retryOpts = {}) {
  const {
    retries = 0,
    backoffMs = 400,
    maxBackoffMs = 4000,
    retryOnStatuses = [429, 502, 503, 504],
    retryOnNetwork = true,
  } = retryOpts;

  let attempt = 0;
  let lastErrText = '';
  const signal = options?.signal;

  while (true) {
    const resp = await robustFetch(url, options);
    if (resp.ok) return resp.json();

    const status = resp.status || 0;
    const isNetwork = status === 0;
    const shouldRetry = attempt < retries && ((retryOnNetwork && isNetwork) || retryOnStatuses.includes(status));
    if (!shouldRetry) {
      lastErrText = lastErrText || (await resp.text());
      throw new Error(`HTTP ${status || '0'}: ${lastErrText || 'Request failed'}`);
    }

    // Compute delay (Retry-After header if present)
    let waitMs = backoffMs * Math.pow(2, attempt);
    waitMs = Math.min(maxBackoffMs, waitMs);
    const ra = resp.headers?.get?.('Retry-After');
    if (ra) {
      const s = Number(ra);
      if (Number.isFinite(s)) waitMs = Math.max(waitMs, s * 1000);
    }
    await delay(waitMs, signal);
    attempt += 1;
  }
}

// Toggle '/api' prefix once upon 404/405
async function tryWithApiToggle(path, options) {
  const base = getBase() || await discoverApiBase().catch(() => '');
  const bases = [];
  if (base) bases.push(base);
  const cachedBase = base;
  // If discovery is in use, apiPath already has '/api' often; we attempt both
  const direct = joinUrl(base || '', path);
  const alt = joinUrl(base || '', path.startsWith('/api/') ? path.replace(/^\/api\//, '/') : `/api${path.startsWith('/') ? '' : '/'}${path}`);

  // First attempt
  let res, status, bodyText;
  try {
    res = await robustFetch(direct, options);
    status = res.status;
    if (res.ok) return res.json();
    bodyText = await res.text();
    if (status === 404 || status === 405) {
      const res2 = await robustFetch(alt, options);
      if (res2.ok) return res2.json();
      const body2 = await res2.text();
      console.warn('[Vancomyzer] API alt failed', { direct: { url: direct, status, bodyText }, alt: { url: alt, status: res2.status, body2 } });
      throw new Error(`HTTP ${res2.status}: ${body2 || 'Request failed'}`);
    }
    throw new Error(`HTTP ${status}: ${bodyText || 'Request failed'}`);
  } catch (e) {
    throw e;
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

// Updated AUC request to use `/interactive/auc` with parity payload shape
export async function postAuc(payload, opts = {}) {
  const base = getBase();
  // Accept both flat AucRequest and nested {patient,regimen,levels}
  let bodyObj = payload;
  if (!payload?.patient && (payload?.age_years != null || payload?.dose_mg != null)) {
    const patient = {
      age_years: payload.age_years ?? payload.ageYears ?? null,
      weight_kg: payload.weight_kg ?? payload.weightKg ?? null,
      height_cm: payload.height_cm ?? payload.heightCm ?? null,
      scr_mg_dl: payload.scr_mg_dl ?? payload.scr ?? payload.serum_creatinine_mg_dl ?? null,
      gender: payload.gender ?? null,
      mic_mg_L: payload.mic ?? payload.mic_mg_L ?? 1,
    };
    const regimen = {
      dose_mg: payload.dose_mg ?? payload.doseMg ?? null,
      interval_hours: payload.interval_hr ?? payload.interval_hours ?? payload.intervalH ?? null,
      infusion_minutes: payload.infusion_minutes ?? payload.infusionMin ?? 60,
    };
    const levels = Array.isArray(payload.levels) ? payload.levels : [];
    bodyObj = { patient, regimen, levels };
  }
  const body = JSON.stringify(sanitizePayload(bodyObj));
  const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, ...opts };
  const path = '/interactive/auc';
  try { console.log('[Vancomyzer] Sending AUC', { base, path, body: bodyObj }); } catch {}
  const json = await tryWithApiToggle(path, request);
  try { console.log('[Vancomyzer] AUC response OK'); } catch {}
  return json;
}

export async function optimize({ patient, regimen, target }, opts = {}) {
  const base = getBase();
  const body = JSON.stringify(sanitizePayload({ patient, regimen, target }));
  const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, ...opts };
  const path = '/optimize';
  return tryWithApiToggle(path, request);
}

export async function pkSimulation(payload, opts = {}) {
  const base = getBase();
  const body = JSON.stringify(sanitizePayload(payload || {}));
  const path = '/pk-simulation';
  const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, ...opts };
  return tryWithApiToggle(path, request);
}
