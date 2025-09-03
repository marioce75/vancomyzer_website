// src/lib/apiBase.js
// In Render → Static Site, set VITE_API_BASE (no trailing /api). Clear build cache & redeploy after changes.
const fromQuery = new URLSearchParams(window.location.search).get("api");

// Normalize: trim trailing slashes
function normalize(url) {
  return (url || "").replace(/\/+$/, "");
}

// Priority: ?api => VITE_API_BASE => ""
export const API_BASE = normalize(
  fromQuery ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  ""
);

// Helper to build endpoints ensuring we only add `/api` once
export function apiPath(path = "") {
  const base = API_BASE;
  // If the provided path already starts with '/api', just join once
  const p = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return base ? `${base}${p}` : p; // if no base (local dev proxy), return relative path
}

// Single warning emitted once if base is missing
if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("[Vancomyzer] Missing VITE_API_BASE; set it in .env or pass ?api=https://your-api");
}

// Helpful debug in dev
if (typeof window !== "undefined") {
  window.__VANCOMYZER_API_BASE__ = API_BASE;
}
