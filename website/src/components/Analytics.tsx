"use client";

/**
 * Privacy-first, cookie-free usage analytics. Mounted once in the root layout.
 *
 * Provider selection. NEXT_PUBLIC_* values are inlined at build time, so a
 * change only takes effect after a rebuild:
 *   1. Plausible when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
 *      src = NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC, default https://plausible.io/js/script.js
 *   2. Umami when NEXT_PUBLIC_UMAMI_WEBSITE_ID is set.
 *      src = NEXT_PUBLIC_UMAMI_SCRIPT_SRC, default https://cloud.umami.is/script.js
 *   3. Otherwise: renders nothing, installs nothing, makes no network requests.
 *
 * Install formats, checked 2026-09-14 against the Plausible installation snippet
 * (plausible/analytics lib/plausible_web/live/installation/instructions.ex),
 * tracker/src/plausible.js + track.js, the live plausible.io/js/script.js and
 * cloud.umami.is/script.js, and docs.umami.is/docs/tracker-configuration:
 *  - Plausible site-specific script (/js/pa-<id>.js), the format Plausible's
 *    installation page now shows: `<script async src=".../js/pa-<id>.js">` plus
 *      window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},
 *      plausible.init=plausible.init||function(i){plausible.o=i||{}}; plausible.init()
 *    The script starts only if init() was called before it loaded
 *    (`if (plausible.o) init(plausible.o)`), then replays plausible.q.
 *  - Plausible legacy script.js with data-domain: starts itself, replays plausible.q.
 *  - Umami: `<script defer src=... data-website-id=...>`. No queue of its own (see
 *    installUmamiEarlyBuffer for why a window.umami stub cannot be used).
 *
 * Custom events are sent by track() in src/lib/analytics.ts, which calls
 * window.plausible(...) or window.umami.track(...). The queue installed below
 * holds events fired before the provider script has finished loading.
 *
 * Privacy safeguards:
 *  - Neither provider sets cookies; no personal identifiers are sent.
 *  - The calculator accepts patient values as URL parameters
 *    (?age=&weight_kg=&serum_creatinine_mg_dl=), so URLs are cleaned before sending:
 *    Umami via data-exclude-search / data-exclude-hash, Plausible site-specific
 *    script via transformRequest. The legacy Plausible script has no such hook
 *    (Plausible discards those parameters only after receipt), so prefer pa-.
 *  - /admin and /research are not counted: Umami via data-before-send, Plausible
 *    site-specific script via transformRequest. Legacy Plausible: page views
 *    only, and only with the script.exclusions.js variant (script.js ignores
 *    data-exclude, and the variant does not filter custom events).
 */

import { useEffect } from "react";
import Script from "next/script";
import { track, type AnalyticsProps } from "@/lib/analytics";

const DEFAULT_PLAUSIBLE_SRC = "https://plausible.io/js/script.js";
const DEFAULT_UMAMI_SRC = "https://cloud.umami.is/script.js";

/** Browser flag set on the first visit from this browser. Holds "1", never an identifier. */
const FIRST_SEEN_KEY = "vmz_first_seen";

/** Admin-only sections kept out of usage reports. */
const EXCLUDED_SECTIONS = ["/admin", "/research"] as const;

/**
 * data-exclude value for Plausible's legacy script.exclusions.js. In its
 * pattern syntax "**" matches across "/", and "/admin" is needed separately
 * because "/admin/**" does not match the bare section path.
 */
const LEGACY_PLAUSIBLE_EXCLUDE = EXCLUDED_SECTIONS.map((section) => `${section}, ${section}/**`).join(", ");

/** Name of the global function Umami calls before every send (data-before-send). */
const UMAMI_BEFORE_SEND = "vmzUmamiBeforeSend";

/**
 * Query parameters kept on URLs sent to Plausible: the campaign parameters
 * Plausible itself keeps. Everything else, including calculator inputs, is
 * removed in the browser before sending.
 */
const KEPT_QUERY_PARAMS = new Set(["ref", "source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);

type Provider =
  | { kind: "plausible"; src: string; domain: string; siteSpecificScript: boolean }
  | { kind: "umami"; src: string; websiteId: string };

/** Request body built by the Plausible tracker: n = event name, u = page URL, r = referrer. */
type PlausiblePayload = { n?: string; u?: string; r?: string | null } & Record<string, unknown>;

type PlausibleInitOptions = { transformRequest?: (payload: PlausiblePayload) => PlausiblePayload | null };

type PlausibleQueue = ((...args: unknown[]) => void) & {
  q?: unknown[][];
  o?: PlausibleInitOptions;
  init?: (options?: PlausibleInitOptions) => void;
};

type UmamiPayload = { url?: string } & Record<string, unknown>;

/**
 * Typed view of the globals this file writes. analytics.ts declares a narrower
 * window.plausible (no init/o), so cast instead of re-declaring the global.
 */
type AnalyticsGlobals = {
  plausible?: PlausibleQueue;
  [UMAMI_BEFORE_SEND]?: (type: string, payload: UmamiPayload) => UmamiPayload | false;
};

function analyticsGlobals(): AnalyticsGlobals {
  return window as unknown as AnalyticsGlobals;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveProvider(): Provider | null {
  // Plain process.env.NEXT_PUBLIC_* reads so Next inlines them into the client bundle.
  const plausibleDomain = nonEmpty(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN);
  if (plausibleDomain) {
    const src = nonEmpty(process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC) ?? DEFAULT_PLAUSIBLE_SRC;
    return { kind: "plausible", src, domain: plausibleDomain, siteSpecificScript: src.includes("/js/pa-") };
  }
  const umamiWebsiteId = nonEmpty(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID);
  if (umamiWebsiteId) {
    return { kind: "umami", src: nonEmpty(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_SRC) ?? DEFAULT_UMAMI_SRC, websiteId: umamiWebsiteId };
  }
  return null;
}

const PROVIDER = resolveProvider();

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_SECTIONS.some((section) => pathname === section || pathname.startsWith(`${section}/`));
}

/** Resolve a (possibly relative) URL, dropping the hash and every query parameter not in KEPT_QUERY_PARAMS. */
function cleanUrl(raw: string): URL {
  const url = new URL(raw, window.location.href);
  for (const key of Array.from(url.searchParams.keys())) {
    if (!KEPT_QUERY_PARAMS.has(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url;
}

// ---------------------------------------------------------------------------
// Plausible
// ---------------------------------------------------------------------------

/**
 * Site-specific Plausible script only: runs for every event before it is sent.
 * Returning null drops the event (tracker/src/track.js). Fails closed so an
 * uncleaned URL is never sent.
 */
function plausibleTransformRequest(payload: PlausiblePayload): PlausiblePayload | null {
  try {
    const page = cleanUrl(payload.u ?? window.location.href);
    if (isExcludedPath(page.pathname)) return null;
    return { ...payload, u: page.toString(), r: payload.r ? cleanUrl(payload.r).toString() : payload.r };
  } catch {
    return null;
  }
}

function createQueue(): PlausibleQueue {
  const queue: PlausibleQueue = (...args: unknown[]) => {
    (queue.q = queue.q || []).push(args);
  };
  return queue;
}

/** Equivalent of Plausible's official stub (see file header). */
function installPlausibleQueue(siteSpecificScript: boolean): void {
  const globals = analyticsGlobals();
  const plausible = globals.plausible ?? (globals.plausible = createQueue());
  plausible.init =
    plausible.init ||
    ((options?: PlausibleInitOptions) => {
      plausible.o = options || {};
    });
  // Only the site-specific script reads init options; the legacy script starts from data-domain.
  if (siteSpecificScript) plausible.init({ transformRequest: plausibleTransformRequest });
}

// ---------------------------------------------------------------------------
// Umami
// ---------------------------------------------------------------------------

/** Umami data-before-send hook: a false-y return cancels the send. Fails closed. */
function umamiBeforeSend(_type: string, payload: UmamiPayload): UmamiPayload | false {
  try {
    const path = new URL(payload.url ?? window.location.href, window.location.href).pathname;
    return isExcludedPath(path) ? false : payload;
  } catch {
    return false;
  }
}

/**
 * Umami has no queue for events fired before its script loads, and the script
 * only creates window.umami when that global does not exist yet (live cloud
 * script: `t.umami||(t.umami={track:...})`). A window.umami stub would therefore
 * stop the real tracker from ever installing. Instead, while Umami loads, early
 * events are buffered through the other global that track() checks, a
 * Plausible-style queue function that Umami never reads, and replayed into
 * window.umami.track once the script has run.
 */
let umamiEarlyBuffer: PlausibleQueue | null = null;

function installUmamiEarlyBuffer(): void {
  const globals = analyticsGlobals();
  // Already loaded (module evaluated again) or the slot is taken: leave it alone.
  if (window.umami || globals.plausible) return;
  umamiEarlyBuffer = createQueue();
  globals.plausible = umamiEarlyBuffer;
}

/**
 * Runs when the Umami script loads or fails. Safe to call more than once.
 * Replayed events are reported against the page open at replay time.
 */
function releaseUmamiEarlyBuffer(): void {
  const buffer = umamiEarlyBuffer;
  const globals = analyticsGlobals();
  if (!buffer || globals.plausible !== buffer) return;
  // Remove the buffer first so later track() calls go straight to Umami.
  globals.plausible = undefined;
  umamiEarlyBuffer = null;
  const umami = window.umami;
  if (!umami || typeof umami.track !== "function") return; // blocked or failed: nothing can be delivered
  for (const [event, options] of buffer.q ?? []) {
    try {
      umami.track(String(event), (options as { props?: AnalyticsProps } | undefined)?.props);
    } catch {
      /* analytics must never break the app */
    }
  }
}

// Install the queue when this module is evaluated. That happens before
// hydration, so before any component effect or click handler can call track().
if (typeof window !== "undefined" && PROVIDER) {
  if (PROVIDER.kind === "plausible") {
    installPlausibleQueue(PROVIDER.siteSpecificScript);
  } else {
    analyticsGlobals()[UMAMI_BEFORE_SEND] = umamiBeforeSend;
    installUmamiEarlyBuffer();
  }
}

export default function Analytics() {
  useEffect(() => {
    if (!PROVIDER) return;
    let firstVisit = false;
    try {
      if (window.localStorage.getItem(FIRST_SEEN_KEY) === null) {
        window.localStorage.setItem(FIRST_SEEN_KEY, "1");
        firstVisit = true;
      }
    } catch {
      // Storage blocked: the visit cannot be remembered, so it is not counted.
      // Counting anyway would report every page load from this browser as new.
    }
    if (firstVisit) track("New Visitor");
  }, []);

  if (!PROVIDER) return null;

  if (PROVIDER.kind === "umami") {
    return (
      <Script
        src={PROVIDER.src}
        strategy="afterInteractive"
        data-website-id={PROVIDER.websiteId}
        data-exclude-search="true"
        data-exclude-hash="true"
        data-before-send={UMAMI_BEFORE_SEND}
        onLoad={releaseUmamiEarlyBuffer}
        onError={releaseUmamiEarlyBuffer}
      />
    );
  }

  if (PROVIDER.siteSpecificScript) {
    // The site domain is built into the script; options were passed to init() above.
    return <Script src={PROVIDER.src} strategy="afterInteractive" />;
  }

  // Legacy script. data-exclude is honoured only by the script.exclusions.js variant, for page views only.
  return (
    <Script
      src={PROVIDER.src}
      strategy="afterInteractive"
      data-domain={PROVIDER.domain}
      data-exclude={LEGACY_PLAUSIBLE_EXCLUDE}
    />
  );
}
