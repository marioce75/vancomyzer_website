import { discoverApiBase, apiPath, ensureHealthy, safeFetch } from "./apiDiscovery";

discoverApiBase().catch(() => {/* ignore; handled on demand */});

export async function calculate(payload) {
  await ensureHealthy();                        // will discover & check /health or /api/health
  const url = apiPath("/calculate");            // joins with discovered base
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${text || ""}`.trim());
  }
  return res.json();
}
