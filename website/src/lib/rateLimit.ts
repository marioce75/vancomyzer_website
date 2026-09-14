/**
 * In-memory rate limiter for anonymous calculator traffic.
 *
 * While open access is on (see lib/openAccess.ts), /api/calculate accepts
 * requests without a session. This caps how many calculations one network
 * address can run per window so a script cannot monopolise the PK engine.
 * Signed-in users are not limited (the route only calls this for anonymous
 * requests).
 *
 * Design notes:
 *  - Fixed window per key. A client can burst up to 2x the limit across a
 *    window boundary; acceptable for a deliberately generous abuse guard and
 *    much simpler than a sliding log.
 *  - State is per server process. With N instances the effective limit is
 *    N x max. Fine for abuse control; use a shared store if a precise global
 *    limit is ever required.
 *  - Memory is bounded two ways: expired buckets are swept at most once per
 *    SWEEP_INTERVAL_MS, lazily on the next check (no timers, so nothing keeps
 *    the process alive or piles up across dev hot reloads), and a hard cap on
 *    tracked keys evicts the oldest buckets if a flood of distinct addresses
 *    arrives inside a single window.
 *  - Limits are read from the environment on every call (see
 *    getCalculateRateLimitConfig), so they are not frozen at build time.
 */

interface Bucket {
  count: number;
  /** Epoch ms at which this window ends. */
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Whole seconds until the current window ends (always >= 1); suitable for Retry-After. */
  retryAfterSeconds: number;
}

const DEFAULT_CALC_MAX = 300;
const DEFAULT_CALC_WINDOW_MS = 10 * 60 * 1000;

const SWEEP_INTERVAL_MS = 60 * 1000;
/** Hard ceiling on tracked keys — far above realistic distinct clients per window. */
const MAX_TRACKED_KEYS = 50_000;
/** Longest textual IP (IPv6 with zone id) fits easily; stops oversized forged header values bloating keys. */
const MAX_KEY_PART_LENGTH = 64;

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

// Note: Map iteration below avoids for...of — this project's tsconfig has no
// `target`, so TypeScript rejects for...of over Map iterators (TS2802).

function sweepExpired(now: number): void {
  // Map.forEach tolerates deleting the entry currently being visited.
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
  lastSweepAt = now;
}

function makeRoomForNewKey(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  sweepExpired(now);
  // Still full: evict the oldest-inserted buckets. Map iterates in insertion
  // order and a bucket is re-inserted whenever its window restarts, so the
  // first entries are the stalest. Deleting while a Map iterator is live is
  // well-defined. Eviction only ever resets a count (fails open); it never
  // blocks a client.
  const oldestFirst = buckets.keys();
  while (buckets.size >= MAX_TRACKED_KEYS) {
    const next = oldestFirst.next();
    if (next.done) break;
    buckets.delete(next.value);
  }
}

/**
 * Count one request against `key` and report whether it is within `max`
 * requests per `windowMs`. Requests over the limit are not counted.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (now - lastSweepAt >= SWEEP_INTERVAL_MS) sweepExpired(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) {
      // Re-insert at the end so insertion order keeps tracking bucket age.
      buckets.delete(key);
    } else {
      makeRoomForNewKey(now);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count >= max) {
    return { allowed: false, limit: max, remaining: 0, retryAfterSeconds };
  }
  bucket.count += 1;
  return { allowed: true, limit: max, remaining: max - bucket.count, retryAfterSeconds };
}

/**
 * Best-effort client network address, used only as a rate-limit key.
 *
 * Order: cf-connecting-ip (set by Cloudflare), then x-real-ip (set by many
 * reverse proxies), then the LAST x-forwarded-for entry. Never the first
 * entry: a client can send its own X-Forwarded-For listing any addresses it
 * likes, and each proxy APPENDS the address it actually received the
 * connection from, so the right-most entry is the one our hosting proxy
 * wrote. Caveat: each header is only as trustworthy as the proxy in front of
 * the app — if that proxy does not set/overwrite a header in this list, a
 * client can supply it and choose its own key.
 *
 * Returns "unknown" when no address header is present (e.g. local
 * development); all such requests share one bucket.
 */
export function getClientIp(headers: Headers): string {
  const cfConnectingIp = headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp.slice(0, MAX_KEY_PART_LENGTH);

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, MAX_KEY_PART_LENGTH);

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((hop) => hop.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last.slice(0, MAX_KEY_PART_LENGTH);
  }

  return "unknown";
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/**
 * Limits for anonymous POST /api/calculate, read at call time.
 * Generous on purpose: the calculator recalculates automatically during data
 * entry, and many clinicians can share one hospital network address.
 *   CALC_RATE_LIMIT_MAX        requests per window (default 300)
 *   CALC_RATE_LIMIT_WINDOW_MS  window length in ms (default 600000 = 10 min)
 * Missing, non-numeric or < 1 values fall back to the defaults.
 */
export function getCalculateRateLimitConfig(): { max: number; windowMs: number } {
  return {
    max: readPositiveInt(process.env.CALC_RATE_LIMIT_MAX, DEFAULT_CALC_MAX),
    windowMs: readPositiveInt(process.env.CALC_RATE_LIMIT_WINDOW_MS, DEFAULT_CALC_WINDOW_MS),
  };
}
