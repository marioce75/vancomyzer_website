/**
 * Legal disclaimer acceptance — the per-browser record that a visitor accepted
 * the disclaimer before using the calculator (enforced by DisclaimerGate).
 *
 * Stored in localStorage under DISCLAIMER_STORAGE_KEY as
 *   { "version": DISCLAIMER_VERSION, "acceptedAt": "<ISO-8601 timestamp>" }
 *
 * An acceptance counts only while BOTH hold:
 *  - its version equals DISCLAIMER_VERSION. Bump DISCLAIMER_VERSION whenever
 *    the legal wording (SECTIONS in DisclaimerModal) or the attestation text
 *    in DisclaimerGate changes; every visitor then has to accept again.
 *  - it is less than 30 days old.
 *
 * localStorage may be missing or throw (private browsing, storage blocked by
 * browser or institutional policy, quota exceeded). Every access is guarded
 * and a failure reads as "not accepted". A successful accept is also kept in
 * module memory, so a visitor whose storage is blocked is not asked again on
 * in-app navigation during the same page load; a full reload asks again.
 *
 * This is an attestation record, not access control. Browser-only: on the
 * server the helpers report "not accepted" and record nothing.
 */

export const DISCLAIMER_VERSION = "2026-09-14";

export const DISCLAIMER_STORAGE_KEY = "vmz_disclaimer_acceptance";

export const DISCLAIMER_ACCEPTANCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Allowance for an acceptedAt slightly ahead of this device's clock (e.g. a
 * small clock correction). Anything further in the future is invalid, so an
 * edited or clock-shifted record cannot keep itself alive indefinitely.
 */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface DisclaimerAcceptance {
  version: string;
  /** ISO-8601 timestamp. */
  acceptedAt: string;
}

// Fallback when localStorage is unavailable. Only ever set in the browser
// (never on the server, where module state would be shared across requests).
let inMemoryAcceptance: DisclaimerAcceptance | null = null;

/** True when `value` is a well-formed, unexpired acceptance of the current version. */
export function isDisclaimerAcceptanceValid(value: unknown, now: number = Date.now()): boolean {
  if (typeof value !== "object" || value === null) return false;
  const { version, acceptedAt } = value as { version?: unknown; acceptedAt?: unknown };
  if (version !== DISCLAIMER_VERSION || typeof acceptedAt !== "string") return false;
  const acceptedMs = Date.parse(acceptedAt);
  if (!Number.isFinite(acceptedMs)) return false;
  const ageMs = now - acceptedMs;
  return ageMs >= -MAX_FUTURE_SKEW_MS && ageMs < DISCLAIMER_ACCEPTANCE_TTL_MS;
}

function readStoredAcceptance(): unknown {
  try {
    const raw = window.localStorage.getItem(DISCLAIMER_STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    // Storage blocked/unavailable, or corrupt JSON: treat as not accepted.
    return null;
  }
}

/** Whether this browser holds a valid acceptance of the current disclaimer version. */
export function hasValidDisclaimerAcceptance(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  return (
    isDisclaimerAcceptanceValid(readStoredAcceptance(), now) ||
    isDisclaimerAcceptanceValid(inMemoryAcceptance, now)
  );
}

/**
 * Record acceptance of the current disclaimer version.
 * @returns true if saved to localStorage; false if storage is unavailable, in
 *          which case the acceptance lasts only for the current page load.
 */
export function recordDisclaimerAcceptance(now: Date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  const record: DisclaimerAcceptance = { version: DISCLAIMER_VERSION, acceptedAt: now.toISOString() };
  inMemoryAcceptance = record;
  try {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
