// Compatibility shim - redirects to new discovery system
// DEPRECATED: Use ../lib/apiDiscovery.ts instead

import { discoverApiBase, getCachedApiBase, apiPath as newApiPath } from './apiDiscovery';

// Legacy function - now just returns cached base or empty string
export function apiBase() {
  try {
    // 1) query param ?api=
    const u = new URL(window.location.href);
    const q = u.searchParams.get('api');
    if (q) return q;
  } catch {}
  
  // 2) meta tag
  const m = document.querySelector('meta[name="vancomyzer-api-base"]');
  if (m?.content) return m.content;
  
  // 3) Cached from discovery
  const cached = getCachedApiBase();
  if (cached) return cached;
  
  // 4) Vite env (fallback)
  try {
    if (import.meta?.env?.VITE_API_BASE) return String(import.meta.env.VITE_API_BASE);
  } catch {}
  
  return '';
}

// Legacy path helper - now uses discovery system when available
export function apiPath(p) {
  try {
    return newApiPath(p);
  } catch {
    // Fallback to legacy behavior
    const base = apiBase();
    const path = String(p || '').replace(/^\/+/, '');
    const full = base ? `${base}/${path}` : `/${path}`;
    return full.replace(/(?<!:)\/{2,}/g, '/');
  }
}

// Back-compat constant - will be empty until discovery runs
export const API_BASE = apiBase();

// Legacy health check - now integrates with discovery
export async function checkHealth() {
  try {
    // Trigger discovery if not already done
    await discoverApiBase();
    return { ok: true };
  } catch (error) {
    console.warn('[Vancomyzer] Legacy health check failed:', error);
    return { ok: false };
  }
}

// Log once on load
(function once() {
  const base = apiBase();
  if (!base) console.warn('[Vancomyzer] Using legacy API base - consider upgrading to apiDiscovery.ts');
  else console.info('[Vancomyzer] Legacy API base =', base);
})();
