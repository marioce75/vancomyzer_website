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
      // FastAPI validation errors come back as detail: [...]
      throw new Error(JSON.stringify(detail || { message: 'Validation failed (422)' }));
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

// --- API methods -----------------------------------------------------------
export const vancomyzerAPI = {
  // Health check
  healthCheck: async () => {
    const response = await api.get(`/health`);
    return response.data;
  },

  // Calculate vancomycin dosing
  calculateDosing: async (patientData) => {
    try {
      const payload = sanitizeForApi(formatPatientForAPI(patientData));
      const response = await api.post(`/calculate-dosing`, payload);
      return response.data;
    } catch (error) {
      console.error('Error in calculateDosing:', error);
      throw error;
    }
  },

  // Bayesian optimization
  bayesianOptimization: async (patientData, levels) => {
    const payload = sanitizeForApi({ ...formatPatientForAPI(patientData), levels });
    const response = await api.post(`/bayesian-optimization`, payload);
    return response.data;
  },

  // PK simulation
  pkSimulation: async (patientData, dose, interval) => {
    const payload = sanitizeForApi({ patient: formatPatientForAPI(patientData), dose, interval });
    const response = await api.post(`/pk-simulation`, payload);
    return response.data;
  },

  // Real-time calculation (fallback if WebSocket fails) — ensure /api prefix
  realTimeCalculation: async (patientData, dose, interval) => {
    const payload = sanitizeForApi({ patient: formatPatientForAPI(patientData), dose, interval });
    const response = await api.post(`/pk-simulation`, payload);
    return response.data;
  },
};

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
      // Remove trailing /api if present for WS root endpoint
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
  get(key) { const item = this.cache.get(key); if (!item) return null; if (Date.now() > item.expiry) { this.cache.delete(key); return null; } return item.data; }
  set(key, data) { if (this.cache.size >= this.maxSize) { const firstKey = this.cache.keys().next().value; this.cache.delete(firstKey); } this.cache.set(key, { data, expiry: Date.now() + this.ttl }); }
  clear() { this.cache.clear(); }
}
export const apiCache = new APICache();
export const cachedVancomyzerAPI = {
  ...vancomyzerAPI,
  calculateDosing: async (patientData) => {
    const cacheKey = JSON.stringify(sanitizeForApi(formatPatientForAPI(patientData)));
    const cached = apiCache.get(cacheKey);
    if (cached) { console.log('Using cached dosing calculation'); return cached; }
    const result = await vancomyzerAPI.calculateDosing(patientData);
    apiCache.set(cacheKey, result);
    return result;
  },
  pkSimulation: async (patientData, dose, interval) => {
    const cacheKey = JSON.stringify(sanitizeForApi({ patientData, dose, interval }));
    const cached = apiCache.get(cacheKey);
    if (cached) { console.log('Using cached PK simulation'); return cached; }
    const result = await vancomyzerAPI.pkSimulation(patientData, dose, interval);
    apiCache.set(cacheKey, result);
    return result;
  },
};

export default api;