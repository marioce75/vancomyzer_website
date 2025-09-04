// src/lib/apiBase.js
const qp = new URLSearchParams(window.location.search);
const fromQuery = qp.get("api");

const trim = (s) => (s || "").replace(/\/+$/, "");

const envBase =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) || "";

export const API_BASE = trim(fromQuery || envBase);

export function apiPath(path = "") {
  const p = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return API_BASE ? `${API_BASE}${p}` : p; // allows relative path in local proxy
}

export async function checkHealth() {
  // Try GET {API_BASE}/api/health, then GET {API_BASE}/health as a fallback.
  const targets = [apiPath("/health"), API_BASE ? `${API_BASE}/health` : "/health"];
  const errors = [];
  for (const url of targets) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return { ok: true, url, status: res.status };
      errors.push({ url, status: res.status });
    } catch (e) {
      errors.push({ url, error: e?.message || String(e) });
    }
  }
  return { ok: false, errors };
}

// Only warn if truly missing (neither ?api nor VITE_API_BASE).
if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("[Vancomyzer] Missing VITE_API_BASE; set it in .env or pass ?api=https://your-api");
}

// Expose for quick inspection
if (typeof window !== "undefined") window.__VANCOMYZER_API_BASE__ = API_BASE;
