import axios from 'axios';

// API configuration
const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8001');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
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

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status}`, response.data);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    // Handle common error scenarios
    if (error.response?.status === 400) {
      throw new Error(error.response.data.detail || 'Invalid request data');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your connection.');
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'An unexpected error occurred');
  }
);

// API methods
export const vancomyzerAPI = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/api/health');
    return response.data;
  },

  // Calculate vancomycin dosing
  calculateDosing: async (patientData) => {
    const response = await api.post('/api/calculate-dosing', patientData);
    return response.data;
  },

  // Bayesian optimization
  bayesianOptimization: async (patientData, levels) => {
    const response = await api.post('/api/bayesian-optimization', {
      patient: patientData,
      levels,
    });
    return response.data;
  },

  // PK simulation
  pkSimulation: async (patientData, dose, interval) => {
    const response = await api.post('/api/pk-simulation', {
      patient: patientData,
      dose,
      interval
    });
    return response.data;
  },

  // Real-time calculation (for fallback if WebSocket fails)
  realTimeCalculation: async (patientData, dose, interval) => {
    const response = await api.post('/api/pk-simulation', {
      patient: patientData,
      dose,
      interval
    });
    return response.data;
  },
};

// WebSocket utilities
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

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        if (this.onConnect) {
          this.onConnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) {
            this.onMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (this.onDisconnect) {
          this.onDisconnect();
        }
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.onError) {
          this.onError(error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
}

// Utility functions
export const formatPatientForAPI = (patient) => {
  // Convert form data to API format
  const apiPatient = { ...patient };
  
  // Convert string numbers to actual numbers
  const numberFields = [
    'age_years', 'age_months', 'gestational_age_weeks', 'postnatal_age_days',
    'weight_kg', 'height_cm', 'serum_creatinine', 'custom_crcl'
  ];
  
  numberFields.forEach(field => {
    if (apiPatient[field] !== null && apiPatient[field] !== '') {
      apiPatient[field] = parseFloat(apiPatient[field]);
    }
  });

  return apiPatient;
};

export const formatLevelForAPI = (level) => {
  return {
    concentration: parseFloat(level.concentration),
    time_after_dose_hours: parseFloat(level.time_after_dose_hours),
    dose_given_mg: parseFloat(level.dose_given_mg),
    infusion_duration_hours: parseFloat(level.infusion_duration_hours || 1.0),
    level_type: level.level_type || 'trough',
    draw_time: level.draw_time || new Date().toISOString(),
    notes: level.notes || ''
  };
};

// Error handling utilities
export const handleAPIError = (error) => {
  console.error('API Error:', error);
  
  if (error.response) {
    // Server responded with error status
    return {
      message: error.response.data.detail || error.response.data.message || 'Server error',
      status: error.response.status,
      data: error.response.data
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      message: 'No response from server. Please check your connection.',
      status: 0,
      data: null
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      status: -1,
      data: null
    };
  }
};

// Cache utilities for performance
class APICache {
  constructor(maxSize = 50, ttl = 300000) { // 5 minutes TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key, data) {
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const apiCache = new APICache();

// Enhanced API methods with caching
export const cachedVancomyzerAPI = {
  ...vancomyzerAPI,

  calculateDosing: async (patientData) => {
    const cacheKey = JSON.stringify(patientData);
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      console.log('Using cached dosing calculation');
      return cached;
    }

    const result = await vancomyzerAPI.calculateDosing(patientData);
    apiCache.set(cacheKey, result);
    return result;
  },

  pkSimulation: async (patientData, dose, interval) => {
    const cacheKey = JSON.stringify({ patientData, dose, interval });
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      console.log('Using cached PK simulation');
      return cached;
    }

    const result = await vancomyzerAPI.pkSimulation(patientData, dose, interval);
    apiCache.set(cacheKey, result);
    return result;
  }
};

export default api;