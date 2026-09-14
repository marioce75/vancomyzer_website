/**
 * Privacy-first usage analytics — a provider-agnostic wrapper around
 * Plausible or Umami. Both are cookieless and report country-level
 * geography out of the box, so no consent banner is needed.
 *
 * The provider script itself is mounted once by <Analytics /> in the root
 * layout. This module only sends custom events.
 *
 * HARD RULE: never pass patient data (age, weight, height, SCr, levels,
 * doses, AUC or any other result) in event props. Only coarse,
 * non-identifying labels such as the calculator workflow mode.
 */

export type AnalyticsEvent =
  | "New Visitor"
  | "Open Calculator"
  | "Disclaimer Accepted"
  | "Disclaimer Declined"
  | "Calculation Run";

export type AnalyticsProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: AnalyticsProps }) => void) & { q?: unknown[] };
    umami?: { track: (event: string, data?: AnalyticsProps) => void };
  }
}

/** Send a custom event. Safe to call anywhere; a no-op on the server or when no provider is configured. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.plausible === "function") {
      window.plausible(event, props ? { props } : undefined);
      return;
    }
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(event, props);
    }
  } catch {
    /* analytics must never break the app */
  }
}
