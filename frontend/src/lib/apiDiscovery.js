// Self-healing API discovery + retry layer
// Probes prioritized candidate bases and caches working base for 24h

const CACHE_KEY = 'vmx.apiBase';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const PROBE_TIMEOUT_MS = 1200; // Per-attempt timeout

// Robust URL joining that preserves scheme and normalizes slashes
function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return (b ? `${b}/${p}` : `/${p}`).replace(/(?<!:)\/+/g, '/');
}

// Fetch wrapper that treats network failures as status 0
async function safeFetch(url, options = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
      text: () => response.text(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0, // Network failure
      json: async () => ({}),
      text: async () => '',
    };
  }
}

// Generate prioritized list of candidate API bases
function getCandidateBases() {
  const candidates = [];

  // 1. ?api= query param (verbatim)
  try {
    const url = new URL(window.location.href);
    const apiParam = url.searchParams.get('api');
    if (apiParam) {
      candidates.push(apiParam);
    }
  } catch {}

  // 2. <meta name="vancomyzer-api-base" content="...">
  const metaTag = document.querySelector('meta[name="vancomyzer-api-base"]');
  if (metaTag?.getAttribute('content')) {
    candidates.push(metaTag.getAttribute('content'));
  }

  // 3. import.meta.env.VITE_API_BASE
  try {
    if (import.meta?.env?.VITE_API_BASE) {
      candidates.push(String(import.meta.env.VITE_API_BASE));
    }
  } catch {}

  // 4. Derived from origin
  try {
    const origin = window.location.origin;
    candidates.push(`${origin}/api`);
    candidates.push(origin);
  } catch {}

  // 5. Fallback production endpoints
  candidates.push('https://vancomyzer.onrender.com/api');
  candidates.push('https://vancomyzer.onrender.com');

  // Remove duplicates while preserving order
  return [...new Set(candidates)];
}

// Test health paths for a given base
async function testHealthPaths(base) {
  const healthPaths = ['/health', '/api/health'];
  
  for (const healthPath of healthPaths) {
    const url = joinUrl(base, healthPath);
    try {
      const response = await safeFetch(url, { method: 'GET' });
      if (response.ok) {
        console.log(`[Vancomyzer] Health check passed: ${url} (${response.status})`);
        return base;
      }
      console.log(`[Vancomyzer] Health check failed: ${url} (${response.status})`);
    } catch (error) {
      console.log(`[Vancomyzer] Health check error: ${url} (${error})`);
    }
  }
  
  return null;
}

// Probe all candidates in parallel and return first working base
async function probeApiBase() {
  const candidates = getCandidateBases();
  console.log('[Vancomyzer] Probing API candidates:', candidates);

  // Race all candidates
  const promises = candidates.map(candidate => testHealthPaths(candidate));
  
  try {
    // Use Promise.allSettled to get all results, then find first successful one
    const results = await Promise.allSettled(promises);
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        console.log(`[Vancomyzer] API discovered: ${result.value}`);
        return result.value;
      }
    }
    
    console.error('[Vancomyzer] No working API base found among candidates:', candidates);
    return null;
  } catch (error) {
    console.error('[Vancomyzer] API discovery failed:', error);
    return null;
  }
}

// Get cached API base if still valid
export function getCachedApiBase() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    if (now - parsed.ts > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return parsed.base;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

// Cache discovered API base
function setCachedApiBase(base) {
  try {
    const cached = {
      base,
      ts: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('[Vancomyzer] Failed to cache API base:', error);
  }
}

// Main discovery function
export async function discoverApiBase(force = false) {
  // Return cached base if valid and not forcing rediscovery
  if (!force) {
    const cached = getCachedApiBase();
    if (cached) {
      return cached;
    }
  }

  // Probe for working base
  const discovered = await probeApiBase();
  
  if (!discovered) {
    throw new Error('No working API base found. Check backend availability and CORS settings.');
  }

  // Cache the discovered base
  setCachedApiBase(discovered);
  
  return discovered;
}

// Join API path with discovered base
export function apiPath(path) {
  const cached = getCachedApiBase();
  if (!cached) {
    throw new Error('No API base available. Call discoverApiBase() first.');
  }
  
  return joinUrl(cached, path);
}

// Ensure API is healthy (throws if not)
export async function ensureHealthy() {
  const base = await discoverApiBase();
  
  // Test health endpoint
  const healthUrl = joinUrl(base, '/health');
  const response = await safeFetch(healthUrl, { method: 'GET' });
  
  if (!response.ok) {
    // Try alternate health path
    const altHealthUrl = joinUrl(base, '/api/health');
    const altResponse = await safeFetch(altHealthUrl, { method: 'GET' });
    
    if (!altResponse.ok) {
      throw new Error(`API health check failed: ${healthUrl} (${response.status}), ${altHealthUrl} (${altResponse.status})`);
    }
  }
}
