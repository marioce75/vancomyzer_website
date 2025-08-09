import axios from 'axios';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// --- helpers ---------------------------------------------------------------
// Remove empty strings/nulls, coerce numbers, normalize enums,
// and map any legacy field names to the backend’s schema.
function sanitizeForApi(payload) {
  const p = { ...payload };

  // Normalize enum-ish strings
  ['population_type', 'sex', 'indication', 'infection_severity'].forEach((k) => {
    if (typeof p[k] === 'string') {
      p[k] = p[k].trim().toLowerCase();
      if (p[k] === '') delete p[k];
    }
  });

  // Map legacy aliases if present
  if (p.serum_creatinine != null && p.serum_creatinine_mgdl == null) {
    const n = Number(p.serum_creatinine);
    if (!Number.isNaN(n)) p.serum_creatinine_mgdl = n;
    delete p.serum_creatinine;
  }

  // Coerce numeric fields and drop blanks
  [
    'age_years','age_months','gestational_age_weeks','postnatal_age_days',
    'weight_kg','height_cm','serum_creatinine_mgdl','creatinine_clearance',
    'target_auc_min','target_auc_max'
  ].forEach((k) => {
    if (p[k] === '' || p[k] == null) { delete p[k]; return; }
    const n = Number(p[k]);
    if (!Number.isNaN(n)) p[k] = n;
  });

  // Adults should not send age_months
  if (p.population_type === 'adult') delete p.age_months;

  return p;
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

// API methods (all paths use /api/* on the backend)
export const vancomyzerAPI = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/api/health'); // fixed prefix
    return response.data;
  },

  // Calculate vancomycin dosing
  calculateDosing: async (patientData) => {
    const payload = sanitizeForApi(formatPatientForAPI(patientData));
    const response = await api.post('/api/calculate-dosing', payload);
    return response.data;
  },

  // Bayesian optimization
  bayesianOptimization: async (patientData, levels) => {
    const payload = sanitizeForApi({ ...formatPatientForAPI(patientData), levels });
    const response = await api.post('/api/bayesian-optimization', payload);
    return response.data;
  },

  // PK simulation
  pkSimulation: async (patientData, dose, interval) => {
    const payload = sanitizeForApi({ patient: formatPatientForAPI(patientData), dose, interval });
    const response = await api.post('/api/pk-simulation', payload);
    return response.data;
  },

  // Real-time calculation (fallback if WebSocket fails) — ensure /api prefix
  realTimeCalculation: async (patientData, dose, interval) => {
    const payload = sanitizeForApi({ patient: formatPatientForAPI(patientData), dose, interval });
    const response = await api.post('/api/pk-simulation', payload);
    return response.data;
  },
};

// WebSocket utilities (unchanged)
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
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/realtime-calc`;
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