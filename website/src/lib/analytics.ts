import { analyticsAllowed, safeProps } from "./analytics-policy";
/** Usage events pass through the site-specific Plausible privacy boundary. */

export type AnalyticsEvent =
  | "Open Calculator"
  | "Disclaimer Accepted"
  | "Disclaimer Declined"
  | "Calculation Run"
  | "Tutorial Play";

export type AnalyticsProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: AnalyticsProps }) => void) & { q?: unknown[] };
  }
}

/** Send a custom event. Safe to call anywhere; a no-op on the server or when no provider is configured. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === "undefined" || !analyticsAllowed(window.location.hostname) || process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true") return;
  const clean = safeProps(event, props);
  if (clean === null) return;
  try {
    if (typeof window.plausible === "function") {
      window.plausible(event, { props: clean });
      return;
    }
  } catch {
    /* analytics must never break the app */
  }
}
