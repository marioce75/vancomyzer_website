/**
 * HMAC verification for the cross-domain pilot-application ingest endpoint.
 *
 * Canonical input (byte-exact agreement with dosys.health sender):
 *   `${timestamp}.${raw_body}`
 *     - timestamp = decimal ASCII Unix seconds, no ms, no leading zeros
 *     - separator = single ASCII period (0x2E), no whitespace, no newline
 *     - raw_body  = exact bytes from `await req.text()` (NOT re-stringified JSON)
 *
 * Algorithm: HMAC-SHA256, output as lowercase hex
 * Header:    X-Pilot-Signature: sha256=<hex>
 * Skew:      reject if |now - timestamp| > 300 seconds
 * Compare:   length-check first, then crypto.timingSafeEqual
 */

import crypto from "crypto";

const SKEW_SECONDS = 300;
const SIG_PREFIX = "sha256=";

export type PilotSignatureFailure =
  | "missing_secret"
  | "missing_timestamp"
  | "missing_signature"
  | "bad_timestamp"
  | "skew_exceeded"
  | "bad_prefix"
  | "length_mismatch"
  | "signature_mismatch";

export type PilotSignatureResult =
  | { ok: true }
  | { ok: false; reason: PilotSignatureFailure };

/**
 * Build the lowercase-hex signature for a given canonical input.
 * Exposed so the smoke-test fixture can assert byte-exact agreement
 * with the dosys.health side.
 */
export function signPilotPayload(
  rawBody: string,
  timestamp: string,
  secret: string,
): string {
  const canonical = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}

/**
 * Verify an incoming pilot-application request.
 * `now` is injectable so tests can pin the clock without monkey-patching Date.
 */
export function verifyPilotSignature(args: {
  rawBody: string;
  timestampHeader: string | null | undefined;
  signatureHeader: string | null | undefined;
  secret: string | undefined;
  now?: number;
}): PilotSignatureResult {
  const { rawBody, timestampHeader, signatureHeader, secret } = args;
  const now = args.now ?? Math.floor(Date.now() / 1000);

  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!timestampHeader) return { ok: false, reason: "missing_timestamp" };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };

  // Timestamp must be a non-negative decimal integer (no leading zeros except "0" itself)
  if (!/^(0|[1-9][0-9]*)$/.test(timestampHeader)) {
    return { ok: false, reason: "bad_timestamp" };
  }
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(now - ts) > SKEW_SECONDS) return { ok: false, reason: "skew_exceeded" };

  if (!signatureHeader.startsWith(SIG_PREFIX)) {
    return { ok: false, reason: "bad_prefix" };
  }
  const providedHex = signatureHeader.slice(SIG_PREFIX.length);

  const expectedHex = signPilotPayload(rawBody, timestampHeader, secret);

  // Length check first — timingSafeEqual throws on length mismatch
  if (providedHex.length !== expectedHex.length) {
    return { ok: false, reason: "length_mismatch" };
  }

  const providedBuf = Buffer.from(providedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (providedBuf.length !== expectedBuf.length) {
    // Catches non-hex input that decoded to a different length
    return { ok: false, reason: "length_mismatch" };
  }
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}
