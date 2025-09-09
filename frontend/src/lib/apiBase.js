// src/lib/apiBase.js
// Centralized API base + path helpers

function trimEndSlashes(s) {
  return String(s || '').replace(/\/+$/, '');
}

function ensureApiBase(s) {
  const base = trimEndSlashes(s);
  if (!base) return '';
  return base.endsWith('/api') ? base : `${base}/api`;
}

export function apiBase() {
  // 1) query param ?api=
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get('api');
    if (q) return ensureApiBase(q);
  } catch {}
  // 2) meta tag
  const m = document.querySelector('meta[name="vancomyzer-api-base"]');
  if (m?.content) return ensureApiBase(m.content);
  // 3) Vite env
  if (import.meta?.env?.VITE_API_BASE) return ensureApiBase(String(import.meta.env.VITE_API_BASE));
  return '';
}

export function apiPath(p) {
  const base = apiBase();
  const path = String(p || '').replace(/^\/+/, '');
  const full = base ? `${base}/${path}` : `/${path}`;
  // Collapse accidental // (but keep protocol //)
  return full.replace(/(?<!:)\/{2,}/g, '/');
}

// Back-compat constant for places importing API_BASE
export const API_BASE = apiBase();

// Non-throwing health probe for legacy callers
export async function checkHealth() {
  const base = apiBase();
  const urls = base ? [`${base}/health`] : ['/api/health', '/health'];
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: 'GET' });
      if (r.ok) {
        try { console.info('[Vancomyzer] API health OK:', u, r.status); } catch {}
        return { ok: true, url: u, status: r.status };
      }
      try { console.warn('[Vancomyzer] API health non-OK:', u, r.status); } catch {}
    } catch (e) {
      try { console.warn('[Vancomyzer] API health error:', u, e?.message || e); } catch {}
    }
  }
  return { ok: false };
}

// Log once on load
(function once() {
  const base = apiBase();
  if (!base) console.warn('[Vancomyzer] Missing VITE_API_BASE; set .env or meta tag');
  else console.info('[Vancomyzer] API base =', base);
})();
