/** Fail-closed browser analytics boundary. No clinical/contact data or arbitrary URLs. */
export const ANALYTICS_HOST = "vancomyzer.com";
const ROUTES = new Set(["/", "/calculator", "/pricing", "/faq", "/about", "/team", "/contact", "/privacy", "/terms", "/disclaimer", "/compliance", "/transparent-dosing", "/transparent-dosing/equations", "/transparent-dosing/cases", "/transparent-dosing/software-checks", "/transparent-dosing/predictive-performance", "/transparent-dosing/engine-crosscheck"]);
const EVENTS: Record<string, Record<string, readonly string[]>> = {"Open Calculator": {"source": ["landing", "landing_hero", "landing_walkthrough", "landing_closing", "pricing"]}, "Disclaimer Accepted": {}, "Disclaimer Declined": {}, "Calculation Run": {"mode": ["empiric", "one_level", "two_levels"]}, "Tutorial Play": {"tutorial": ["calculator_walkthrough_v2"]}};
export function analyticsAllowed(hostname: string): boolean {
  return hostname === ANALYTICS_HOST || hostname === `www.${ANALYTICS_HOST}`;
}
export function safeProps(event: string, props?: Record<string, unknown>): Record<string, string> | null {
  if (!Object.prototype.hasOwnProperty.call(EVENTS, event)) return null;
  const clean: Record<string, string> = {};
  for (const [key, values] of Object.entries(EVENTS[event])) {
    const value = props?.[key];
    if (typeof value === "string" && values.includes(value)) clean[key] = value;
  }
  return clean;
}
export function safePage(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !analyticsAllowed(url.hostname) || url.port || url.username || url.password) return null;
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (!ROUTES.has(path)) return null;
    // Observed nonpersonal campaign names from the read-only acquisition audit.
    // Exclude known developer traffic entirely, rather than relabeling it direct.
    if (["analytics_verification", "tracking_check"].includes(url.searchParams.get("utm_campaign") ?? "")) return null;
    const clean = new URL(path, `https://${ANALYTICS_HOST}`);
    for (const [key, values] of Object.entries({utm_campaign: ["founder_intro", "calculator_tutorial", "company_intro"], utm_source: ["linkedin", "google", "bing", "newsletter", "youtube", "x", "twitter", "chatgpt"], utm_medium: ["paid-social", "paid_social", "social", "cpc", "email", "referral"]})) {
      const value = url.searchParams.get(key);
      if (value && values.includes(value)) clean.searchParams.set(key, value);
    }
    return clean.href;
  } catch { return null; }
}
let developerVisit = false;
export function transformAnalytics(payload: Record<string, unknown>): Record<string, unknown> | null {
  // Keep a boolean for this document lifetime so SPA navigation cannot relabel
  // a known developer visit as direct traffic. Never store the original URL.
  if (typeof payload.u === "string") {
    try { developerVisit ||= ["analytics_verification", "tracking_check"].includes(new URL(payload.u).searchParams.get("utm_campaign") ?? ""); } catch { /* invalid URLs fail below */ }
  }
  if (developerVisit) return null;
  const event = payload.n;
  if (typeof event !== "string") return null;
  const props = event === "pageview" || event === "engagement" ? {} : safeProps(event, payload.p as Record<string, unknown>);
  const url = typeof payload.u === "string" ? safePage(payload.u) : null;
  if (!url || props === null) return null;
  // Construct a fresh envelope. Do not forward arbitrary payload fields, metadata,
  // revenue, referrer paths, titles, query strings, identifiers or form values.
  const result: Record<string, unknown> = { n: event, u: url, d: ANALYTICS_HOST, p: props, r: null };
  if (typeof payload.v === "number" && Number.isSafeInteger(payload.v) && payload.v >= 0 && payload.v <= 1000) result.v = payload.v;
  if (typeof payload.v === "string" && /^\d+(\.\d+)*$/.test(payload.v)) result.v = payload.v;
  if (payload.i === false || event === "engagement") result.i = false;
  if (event === "engagement") for (const key of ["sd", "e"]) {
    if (typeof payload[key] === "number" && Number.isFinite(payload[key]) && payload[key] >= 0) result[key] = payload[key];
  }
  // Only a fixed set of public acquisition origins; never forward paths or arbitrary hostnames.
  if (typeof payload.r === "string") {
    try {
      const ref = new URL(payload.r);
      if (["www.linkedin.com", "linkedin.com", "www.google.com", "www.bing.com", "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "x.com", "www.x.com", "twitter.com", "www.twitter.com", "t.co", "chatgpt.com", "chat.openai.com", "dosys.health", "vancomyzer.com"].includes(ref.hostname) && ref.protocol === "https:" && !ref.port && !ref.username && !ref.password) result.r = ref.origin + "/";
    } catch { /* malformed referrers remain absent */ }
  }
  return result;
}
