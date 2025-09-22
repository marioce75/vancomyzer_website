// Interactive AUC API service using self-healing discovery layer

import { apiPath, ensureHealthy } from '../lib/apiDiscovery';

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
  return new Promise((resolve, reject) => {
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
export async function postAuc(payload, opts = {}) {
  const url = apiPath('/interactive/auc');
  const body = JSON.stringify(sanitizePayload(payload));
  try { console.log('[Vancomyzer] Sending AUC request to:', url, 'payload:', payload); } catch {}

  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    ...opts,
  };

  const json = await fetchJsonWithRetry(url, request, { retries: opts.retries ?? 0 });
  try { console.log('[Vancomyzer] AUC response OK'); } catch {}
  return json;
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
    const request = { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(sanitizePayload({ patient, regimen, target })),
      ...opts
    };
    return await fetchJsonWithRetry(url, request, { retries: opts.retries ?? 0 });
  } catch {
    return {};
  }
}

export async function pkSimulation(payload, opts = {}) {
  const url = apiPath('/pk-simulation');
  const request = { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(sanitizePayload(payload || {})), 
    ...opts 
  };
  return fetchJsonWithRetry(url, request, { retries: opts.retries ?? 0 });
}
