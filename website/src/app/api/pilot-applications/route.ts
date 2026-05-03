/**
 * POST /api/pilot-applications
 *
 * Public ingest endpoint for hospital pilot applications submitted from
 * dosys.health/pilot. Authenticated by HMAC-SHA256 over the canonical
 * input `${timestamp}.${raw_body}` (see lib/pilotApplication/hmac.ts).
 *
 * Status semantics (per contract with sender):
 *   201  { id, status: "pending" }   accepted
 *   400  validation failure (zod)
 *   401  signature missing/invalid or skew exceeded
 *   409  duplicate within 1h idempotency window
 *   500  server error (db, etc.)
 *
 * NOT in middleware.ts matcher — fully public, no session required.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ZodError } from "zod";
import { pilotApplicationIngestSchema } from "@/lib/pilotApplication/schema";
import { verifyPilotSignature } from "@/lib/pilotApplication/hmac";
import {
  createPilotApplication,
  findPilotApplicationByIdempotencyKey,
  getPilotApplicationById,
  logSecurityEvent,
} from "@/lib/db";
import { sendPilotApplicationNotification } from "@/lib/email";

export const runtime = "nodejs"; // crypto.timingSafeEqual

function ip(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Idempotency key = sha256(email | hospital | floor(submittedAt / 1h)).
 * Collapses retries within the same hour but allows legitimate re-submits later.
 */
function buildIdempotencyKey(email: string, hospital: string, submittedAt: string): string {
  const hourBucket = Math.floor(new Date(submittedAt).getTime() / 3_600_000);
  return crypto
    .createHash("sha256")
    .update(`${email}|${hospital}|${hourBucket}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  // 1. Read raw body BEFORE any parsing — HMAC is computed over the wire bytes.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }

  // 2. Verify HMAC signature first — fail before touching JSON.
  const sigResult = verifyPilotSignature({
    rawBody,
    timestampHeader: request.headers.get("x-pilot-timestamp"),
    signatureHeader: request.headers.get("x-pilot-signature"),
    secret: process.env.PILOT_INGEST_HMAC_SECRET,
  });
  if (!sigResult.ok) {
    logSecurityEvent({
      action: "PILOT_APPLICATION_REJECTED",
      ip_address: ip(request),
      user_agent: request.headers.get("user-agent"),
      details: JSON.stringify({ reason: sigResult.reason }),
      severity: "warn",
    });
    return NextResponse.json(
      { error: "Unauthorized.", reason: sigResult.reason },
      { status: 401 },
    );
  }

  // 3. Parse + validate payload.
  let parsed;
  try {
    const json = JSON.parse(rawBody);
    parsed = pilotApplicationIngestSchema.parse(json);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // 4. Idempotency check — same email + hospital + hour-bucket = duplicate.
  const idempotencyKey = buildIdempotencyKey(
    parsed.email,
    parsed.hospital,
    parsed.submittedAt,
  );
  const existing = findPilotApplicationByIdempotencyKey(idempotencyKey);
  if (existing) {
    logSecurityEvent({
      action: "PILOT_APPLICATION_DUPLICATE",
      ip_address: ip(request),
      user_agent: request.headers.get("user-agent"),
      details: JSON.stringify({
        existing_id: existing.id,
        hospital: parsed.hospital,
        email: parsed.email,
      }),
      severity: "info",
    });
    return NextResponse.json(
      { error: "Duplicate application within idempotency window.", id: existing.id },
      { status: 409 },
    );
  }

  // 5. Persist.
  let id: number;
  try {
    id = createPilotApplication({
      contact_name: parsed.name,
      contact_title: parsed.title,
      hospital_name: parsed.hospital,
      email: parsed.email,
      phone: parsed.phone ?? null,
      bed_count: parsed.beds ?? null,
      current_monitoring: parsed.monitoring ?? null,
      source: parsed.source,
      submitted_at: parsed.submittedAt,
      idempotency_key: idempotencyKey,
    });
  } catch (err) {
    console.error("[PILOT_INGEST] Insert failed:", err);
    return NextResponse.json({ error: "Persistence failed." }, { status: 500 });
  }

  // 6. Audit-log the accepted id (so cross-system traces are possible).
  logSecurityEvent({
    action: "PILOT_APPLICATION_RECEIVED",
    ip_address: ip(request),
    user_agent: request.headers.get("user-agent"),
    details: JSON.stringify({
      id,
      hospital: parsed.hospital,
      email: parsed.email,
      source: parsed.source,
    }),
    severity: "info",
  });
  console.log(
    `[PILOT_INGEST] Accepted application id=${id} hospital="${parsed.hospital}" email="${parsed.email}"`,
  );

  // 7. Fire notification email — failure must NOT fail the request.
  const stored = getPilotApplicationById(id);
  if (stored) {
    try {
      await sendPilotApplicationNotification(stored);
    } catch (err) {
      console.error("[PILOT_INGEST] Notification email failed (non-fatal):", err);
    }
  }

  return NextResponse.json({ id, status: "pending" }, { status: 201 });
}
