import axios from 'axios';

// --- API BASE --------------------------------------------------------------
// Production backend API (Render)
const API_BASE = "https://vancomyzer.onrender.com/api";
console.info('API_BASE =', API_BASE);

// Axios configuration (include Accept header for CORS clarity)
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// --- helpers ---------------------------------------------------------------
// Remove empty strings/nulls, coerce numbers/booleans, normalize enums,
// and map any legacy field names to the backend’s schema.
function sanitizeForApi(payload) {
  const p = { ...payload };

  // Bring common aliases/variants onto the expected keys
  if (!p.gender) {
    const g = (p.gender ?? p.sex ?? p.Gender ?? p.Sex ?? '')
      .toString()
      .trim()
      .toLowerCase();
    if (g) p.gender = g;
  }
  if (p.gender === 'm') p.gender = 'male';
  if (p.gender === 'f') p.gender = 'female';

  // Normalize string enums and drop empties
  ['gender', 'severity', 'population_type', 'indication', 'crcl_method'].forEach((k) => {
    if (typeof p[k] === 'string') {
      p[k] = p[k].trim();
      if (p[k] === '') delete p[k];
      else p[k] = p[k].toLowerCase();
    }
  });

  // Coerce booleans that may arrive as strings
  ['is_renal_stable', 'is_on_hemodialysis', 'is_on_crrt'].forEach((k) => {
    if (typeof p[k] === 'string') {
      p[k] = p[k].toLowerCase() === 'true';
    }
  });

  // Coerce numeric fields and drop blanks (include custom_crcl!)
  [
    'age_years',
    'age_months',
    'gestational_age_weeks',
    'postnatal_age_days',
    'weight_kg',
    'height_cm',
    'serum_creatinine',
    'custom_crcl',
  ].forEach((k) => {
    if (p[k] === '' || p[k] == null) { delete p[k]; return; }
    const n = Number(p[k]);
    if (Number.isNaN(n)) delete p[k];
    else p[k] = n;
  });

  // Final guard: backend needs a valid gender
  if (!p.gender || !['male', 'female'].includes(p.gender)) {
    throw new Error('Please select Gender (male or female).');
  }

  return p;
}

// --- levels helper: normalize/validate levels for Bayesian fit ----------
function normalizeLevels(levels) {
  if (!Array.isArray(levels)) return [];
  const out = [];
  for (const lv of levels) {
    if (!lv) continue;
    // Accept {time, concentration} or {t, conc} or {hours, value}
    const time = lv.time ?? lv.t ?? lv.hours ?? lv.sample_time ?? lv.at;
    const concentration = lv.concentration ?? lv.conc ?? lv.value ?? lv.c;
    const t = (time !== undefined && time !== null) ? time : null;
    const c = (concentration !== undefined && concentration !== null) ? Number(concentration) : null;
    if (t !== null && c !== null && Number.isFinite(c)) {
      out.push({ time: t, concentration: c });
    }
  }
  return out;
}

// Anthropometric helper functions (client hints only; server authoritative)
function cmToIn(cm){ return cm / 2.54; }
function metersFromCm(cm){ return cm / 100; }
function calcIBWkg(sex, height_cm){
  if (!height_cm) return null;
  const inchesOver60 = Math.max(0, cmToIn(height_cm) - 60);
  const base = (sex || '').toLowerCase() === 'female' ? 45.5 : 50;
  return base + 2.3 * inchesOver60;
}
function calcBMIkgm2(weight_kg, height_cm){
  if (!weight_kg || !height_cm) return null;
  const m = metersFromCm(height_cm);
  return m > 0 ? weight_kg / (m*m) : null;
}
function calcAdjBWkg(tbw, ibw){
  if (tbw == null || ibw == null) return null;
  return ibw + 0.4 * (tbw - ibw);
}
function pickWeightForCG(tbw, ibw){
  if (tbw == null || ibw == null) return null;
  if (tbw < ibw) return tbw;
  if (tbw >= 1.2 * ibw) return calcAdjBWkg(tbw, ibw);
  return ibw;
}

// Convert form data to API format (kept from previous version, but we’ll still sanitize)
export const formatPatientForAPI = (patient) => {
  const apiPatient = { ...patient };
  const numberFields = [
    'age_years','age_months','gestational_age_weeks','postnatal_age_days',
    'weight_kg','height_cm','serum_creatinine','custom_crcl'
  ];
  numberFields.forEach(field => {
    if (apiPatient[field] !== null && apiPatient[field] !== '') {
      apiPatient[field] = parseFloat(apiPatient[field]);
    }
  });

  // Client-side anthropometrics (adult only, if valid height)
  if (apiPatient.population_type === 'adult' && apiPatient.height_cm && apiPatient.height_cm >= 100 && apiPatient.height_cm <= 250) {
    const ibw_kg = calcIBWkg(apiPatient.gender || apiPatient.sex, apiPatient.height_cm);
    const bmi = calcBMIkgm2(apiPatient.weight_kg, apiPatient.height_cm);
    const weight_for_cg_kg = pickWeightForCG(apiPatient.weight_kg, ibw_kg);
    const adjbw_kg = (apiPatient.weight_kg && ibw_kg && apiPatient.weight_kg >= 1.2 * ibw_kg)
      ? calcAdjBWkg(apiPatient.weight_kg, ibw_kg)
      : null;
    apiPatient.ibw_kg = ibw_kg ? +ibw_kg.toFixed(1) : null;
    apiPatient.adjbw_kg = adjbw_kg ? +adjbw_kg.toFixed(1) : null;
    apiPatient.weight_for_cg_kg = weight_for_cg_kg ? +weight_for_cg_kg.toFixed(1) : null;
    apiPatient.bmi = bmi ? +bmi.toFixed(1) : null;
  }
  return apiPatient;
};

// Axios interceptors with better 422 reporting
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status}`, response.data);
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    console.error('API Response Error:', detail || error.response?.data || error.message);

    if (status === 400) {
      throw new Error(detail || 'Invalid request data');
    } else if (status === 422) {
      const detail = error.response?.data?.detail;
      try {
        console.group('FastAPI 422 Validation Error');
        console.log('Endpoint:', error.config?.url);
        console.log('Payload:', error.config?.data);
        console.log('Detail:', detail);
        console.groupEnd();
      } catch (_) {}
      const friendly =
        Array.isArray(detail)
          ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join('; ')
          : (typeof detail === 'string' ? detail : 'Validation failed (422)');
      throw new Error(friendly);
    } else if (status === 500) {
      throw new Error('Server error. Please try again later.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your connection.');
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw new Error(error.message || 'An unexpected error occurred');
  }
);

// --- Fetch helper (explicit CORS preflight example) ------------------------
// This mirrors calculateDosing but uses fetch with mode: 'cors' per instructions.
export async function calculateDosingFetch(samplePatient) {
  const payload = sanitizeForApi(formatPatientForAPI(samplePatient));
  const resp = await fetch(`${API_BASE}/calculate-dosing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    mode: 'cors', // Ensures browser performs CORS preflight when needed
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API Error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// --- API methods (updated) -------------------------------------------------
export async function bayesianOptimization(patient, levels = []) {
  // Ensure patient object exists
  const safePatient = patient || {};
  // Sanitize & format patient, normalize levels
  let formattedPatient;
  try {
    formattedPatient = sanitizeForApi(formatPatientForAPI(safePatient));
  } catch (e) {
    // Surface local validation errors immediately
    throw e;
  }
  const normalizedLevels = normalizeLevels(levels);
  // Construct payload EXACTLY as required by FastAPI: { patient: {...}, levels: [...] }
  const payload = { patient: formattedPatient, levels: normalizedLevels };
  try {
    const res = await api.post('/bayesian-optimization', payload, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    return res.data;
  } catch (error) {
    const status = error?.response?.status;
    if (status >= 400 && status < 500) {
      const detail = error?.response?.data?.detail;
      if (detail) {
        console.error('[bayesianOptimization] 4xx validation/detail:', detail);
      }
    }
    throw error;
  }
}

export async function calculateDosing(patient) {
  const res = await api.post(`/calculate-dosing`, patient, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  });
  return res.data;
}

export const vancomyzerAPI = {
  healthCheck: async () => {
    const response = await api.get(`/health`);
    return response.data;
  },
  calculateDosing,
  bayesianOptimization,
  pkSimulation: async (patientData, dose, interval) => {
    const payload = sanitizeForApi({ patient: formatPatientForAPI(patientData), dose, interval });
    const response = await api.post(`/pk-simulation`, payload);
    return response.data;
  },
  realTimeCalculation: async (patientData, dose, interval) => {
    const payload = sanitizeForApi({ patient: formatPatientForAPI(patientData), dose, interval });
    const response = await api.post(`/pk-simulation`, payload);
    return response.data;
  },
};

// Convenience wrapper to accept either {patient, levels} or (patient, levels)
export async function bayesOptimizeSafe(arg1, arg2) {
  if (arg1 && typeof arg1 === 'object' && 'patient' in arg1) {
    const body = {
      patient: sanitizeForApi(formatPatientForAPI(arg1.patient)),
      levels: normalizeLevels(arg1.levels)
    };
    return (await api.post(`/bayesian-optimization`, body)).data;
  }
  const patient = sanitizeForApi(formatPatientForAPI(arg1));
  const levels = normalizeLevels(arg2);
  return (await api.post(`/bayesian-optimization`, { patient, levels })).data;
}

// --- WebSocket utilities (fix base so it does NOT include /api prefix) -----
export class VancomyzerWebSocket {
  constructor(onMessage, onError, onConnect, onDisconnect) {
    this.onMessage = onMessage;
    this.onError = onError;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }
  connect() {
    try {
      const httpBase = API_BASE.replace(/\/?api\/?$/, '');
      const wsBase = httpBase.replace(/^http/i, 'ws');
      const wsUrl = `${wsBase}/ws/realtime-calc`;
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => { console.log('WebSocket connected'); this.reconnectAttempts = 0; this.onConnect?.(); };
      this.ws.onmessage = (event) => { try { const data = JSON.parse(event.data); this.onMessage?.(data); } catch (e) { console.error('WS parse error', e); } };
      this.ws.onclose = () => { console.log('WebSocket disconnected'); this.onDisconnect?.(); this.attemptReconnect(); };
      this.ws.onerror = (error) => { console.error('WebSocket error:', error); this.onError?.(error); };
    } catch (error) { console.error('Failed to create WebSocket:', error); this.onError?.(error); }
  }
  send(data) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data)); else console.error('WebSocket is not connected'); }
  close() { this.ws?.close(); }
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
}

// Debug/helper export
export const getApiBase = () => API_BASE;

// Error handling utilities (kept)
export const handleAPIError = (error) => {
  console.error('API Error:', error);
  if (error.response) {
    return { message: error.response.data.detail || error.response.data.message || 'Server error', status: error.response.status, data: error.response.data };
  } else if (error.request) {
    return { message: 'No response from server. Please check your connection.', status: 0, data: null };
  }
  return { message: error.message || 'An unexpected error occurred', status: -1, data: null };
};

// Simple in-memory cache (kept)
class APICache {
  constructor(maxSize = 50, ttl = 300000) { this.cache = new Map(); this.maxSize = maxSize; this.ttl = ttl; }
  get(key) { const item = this.cache.get(key); if (!item) return null; if (Date.now() > item.expiry) { this.cache.delete(item); return null; } return item.data; }
  set(key, data) { if (this.cache.size >= this.maxSize) { const firstKey = this.cache.keys().next().value; this.cache.delete(firstKey); } this.cache.set(key, { data, expiry: Date.now() + this.ttl }); }
  clear() { this.cache.clear(); }
}
export const apiCache = new APICache();
const fitCache = new APICache(100, 10 * 60 * 1000);

function hashKey(obj){ try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0,256); } catch { return JSON.stringify(obj); } }

function normalizeBayesResponse(raw){ if(!raw || typeof raw !== 'object') return raw; const r = { ...raw };
  r.auc24 = r.auc24 ?? r.auc_24 ?? r.auc_24h ?? r.predicted_auc_24 ?? r.AUC24;
  r.cmin = r.cmin ?? r.trough ?? r.predicted_trough ?? r.Cmin;
  r.cmax = r.cmax ?? r.peak ?? r.predicted_peak ?? r.Cmax;
  if(r.recommendation && !r.recommendation.regimen && (r.recommendation.dose_mg && r.recommendation.interval_h)){
    r.recommendation = { ...r.recommendation, regimen: { dose_mg: r.recommendation.dose_mg, interval_h: r.recommendation.interval_h } };
  }
  return r;
}

function buildBody(base){ const b = {}; Object.entries(base).forEach(([k,v])=>{ if(v!==null && v!==undefined) b[k]=v; }); return b; }

function isRegimenUnsupported(error){ const msg = error?.message || ''; const dataDetail = error?.response?.data?.detail; const detailStr = typeof dataDetail === 'string' ? dataDetail : JSON.stringify(dataDetail||'');
  const combined = (msg + ' ' + detailStr).toLowerCase();
  return (error?.response?.status === 400 || error?.response?.status === 422) && combined.includes('regimen');
}

let BAYES_REGIMEN_CAPABILITY = null;

export async function bayesOptimize(patient, levels = null, regimen = null){
  const payloadPatient = sanitizeForApi(formatPatientForAPI(patient));
  const body = buildBody({ patient: payloadPatient, levels: normalizeLevels(levels), regimen });
  try {
    const res = await api.post(`/bayesian-optimization`, body);
    BAYES_REGIMEN_CAPABILITY = BAYES_REGIMEN_CAPABILITY ?? !!regimen;
    console.log('[Bayes] one-call success');
    return normalizeBayesResponse(res.data);
  } catch (err){ if(regimen && isRegimenUnsupported(err)){ BAYES_REGIMEN_CAPABILITY = false; throw Object.assign(err, { _regimenUnsupported: true }); } throw err; }
}

export async function simulateWithBayes(patient, levels = null, regimen){
  const key = hashKey({ p: sanitizeForApi(formatPatientForAPI(patient)), levels });
  if(BAYES_REGIMEN_CAPABILITY !== false){
    try { return await bayesOptimize(patient, levels, regimen); } catch(err){ if(!err._regimenUnsupported) throw err; console.log('[Bayes] regimen unsupported, switching to 2-step'); }
  }
  let fit = fitCache.get(key);
  if(!fit){ console.log('[Bayes] fetching new fit (2-step path)'); fit = await bayesOptimize(patient, levels, null); fitCache.set(key, fit); }
  const model_params = fit.model_params || fit.params || fit.modelParams;
  const payloadPatient = sanitizeForApi(formatPatientForAPI(patient));
  const simBody = buildBody({ patient: payloadPatient, regimen, model_params });
  const simRes = await api.post(`/pk-simulation`, simBody);
  const merged = normalizeBayesResponse({ ...simRes.data, model_params });
  return merged;
}

export async function checkBayesRegimenSupport(samplePatient){ if(BAYES_REGIMEN_CAPABILITY !== null) return BAYES_REGIMEN_CAPABILITY; try { await bayesOptimize(samplePatient, null, { dose_mg: 1000, interval_h: 12 }); BAYES_REGIMEN_CAPABILITY = true; } catch(e){ BAYES_REGIMEN_CAPABILITY = e._regimenUnsupported ? false : true; } return BAYES_REGIMEN_CAPABILITY; }

export const BayesianAPI = { initial: bayesOptimize, interactive: simulateWithBayes };

export const _bayesianTest = async (patient, levels, regimen) => {
  const payloadPatient = sanitizeForApi(formatPatientForAPI(patient));
  const body = buildBody({ patient: payloadPatient, levels: normalizeLevels(levels), regimen });
  const res = await api.post(`/bayesian-optimization`, body);
  return normalizeBayesResponse(res.data);
};

export const _regimenSupportProbe = async (samplePatient) => {
  const key = hashKey({ p: sanitizeForApi(formatPatientForAPI(samplePatient)), levels: null });
  let fit = fitCache.get(key);
  if(!fit){ console.log('[Bayes] fetching new fit for regimen support probe'); fit = await bayesOptimize(samplePatient, null, null); fitCache.set(key, fit); }
  return fit;
};

export default api;
export { sanitizeForApi };