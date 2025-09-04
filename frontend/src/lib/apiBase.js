// src/lib/apiBase.js
const qp = new URLSearchParams(window.location.search);
const fromQuery = qp.get("api");
const DEFAULT_API_BASE = "https://vancomyzer.onrender.com"; // safe fallback for prod

const trim = (s) => (s || "").replace(/\/+$/, "");
const envBase =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) || "";

// Priority: ?api -> env -> default
export const API_BASE = trim(fromQuery || envBase || DEFAULT_API_BASE);

// Build URLs ensuring we add `/api` only once
export function apiPath(path = "") {
  const p = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return `${API_BASE}${p}`;
}

// Non-blocking health probe (GET). Logs results, never throws.
export async function checkHealth() {
  const urls = [`${API_BASE}/api/health`, `${API_BASE}/health`];
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: "GET" });
      if (r.ok) {
        console.info("[Vancomyzer] API health OK:", u, r.status);
        return { ok: true, url: u, status: r.status };
      }
      console.warn("[Vancomyzer] API health non-OK:", u, r.status);
    } catch (e) {
      console.warn("[Vancomyzer] API health error:", u, e?.message || e);
    }
  }
  return { ok: false };
}

if (typeof window !== "undefined") window.__VANCOMYZER_API_BASE__ = API_BASE;
