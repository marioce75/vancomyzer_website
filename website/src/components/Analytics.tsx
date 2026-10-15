"use client";
import { useEffect, useState } from "react";
import Script from "next/script";
import { analyticsConfig } from "@/lib/analytics-config";
import { analyticsAllowed, transformAnalytics } from "@/lib/analytics-policy";

/** One automatic pageview owner, initialized before the script is mounted.
 * Legacy Plausible/Umami configs fail closed: they need an equivalent tested
 * privacy boundary before being enabled. Local/preview hosts never load a tracker.
 */
export default function Analytics() {
  const [ready, setReady] = useState(false);
  const { src, status } = analyticsConfig(process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC, process.env.NEXT_PUBLIC_ANALYTICS_DISABLED);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true" || !analyticsAllowed(window.location.hostname)) return;
    if (!src) {
      console.warn(`Usage analytics inactive: ${status}. Check the site-specific Plausible script configuration.`);
      return;
    }
    const globals = window as unknown as { plausible?: ((...args: unknown[]) => void) & { q?: unknown[][]; init?: (options: unknown) => void; o?: unknown } };
    const plausible: NonNullable<typeof globals.plausible> = globals.plausible ?? (globals.plausible = (...args: unknown[]) => { (plausible.q ??= []).push(args); });
    plausible.init ??= (options: unknown) => { plausible.o = options; };
    plausible.init({ transformRequest: transformAnalytics, formSubmissions: false, outboundLinks: false, fileDownloads: false, autoCapturePageviews: true });
    setReady(true);
  }, [src, status]);
  return ready && src ? <Script src={src} strategy="afterInteractive" /> : null;
}
