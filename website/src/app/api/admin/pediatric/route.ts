import { NextRequest, NextResponse } from 'next/server';
import { getPediatricAdmin } from '@/lib/pediatric/requireAdmin';
import { ACK_COOKIE_NAME, verifyAcknowledgementToken, type AckVerdict } from '@/lib/pediatric/acknowledgement';
import { pediatricStatus } from '@/lib/pediatric/status';
import { pediatricCurve, runPediatricEngine, type PediatricRequest } from '@/lib/pediatric/engine';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const MAX_BODY_BYTES = 64 * 1024;

function acknowledgement(request: NextRequest, admin: { id: number; sessionToken: string }): AckVerdict {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return { ok: false, reason: 'missing' };
  return verifyAcknowledgementToken(request.cookies.get(ACK_COOKIE_NAME)?.value, { userId: admin.id, sessionToken: admin.sessionToken, secret });
}

export async function GET(request: NextRequest) {
  const admin = await getPediatricAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 403, headers });
  const ack = acknowledgement(request, admin);
  return NextResponse.json({ ...pediatricStatus, acknowledged: ack.ok, acknowledgement_expires_at: ack.ok ? new Date(ack.expiresAt).toISOString() : null }, { headers });
}

/**
 * Research calculation. Order: admin authorization, then the per-session
 * research acknowledgement, then (and only then) the body is read. Nothing
 * from the request or result is persisted or logged; the only telemetry is a
 * count with status and duration.
 */
export async function POST(request: NextRequest) {
  const admin = await getPediatricAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 403, headers });
  const ack = acknowledgement(request, admin);
  if (!ack.ok) return NextResponse.json({ status: 'acknowledgement_required', reason: ack.reason, message: 'Acknowledge the research statement for this session before calculating.' }, { status: 403, headers });
  const started = Date.now();
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ status: 'invalid', message: 'Request too large.', field_errors: { request: 'Body exceeds 64 KB.' } }, { status: 413, headers });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ status: 'invalid', message: 'Invalid JSON body.', field_errors: { request: 'Invalid JSON.' } }, { status: 400, headers });
  }
  const outcome = runPediatricEngine(body);
  const code = outcome.status === 'ok' ? 200 : outcome.status === 'unsupported' ? 422 : outcome.status === 'needs_verification' ? 409 : 400;
  console.log(`[PEDIATRIC PREVIEW] ${JSON.stringify({ status: outcome.status, duration_ms: Date.now() - started })}`);
  if (outcome.status !== 'ok') return NextResponse.json(outcome, { status: code, headers });
  return NextResponse.json({ ...outcome, curve: pediatricCurve(outcome, body as PediatricRequest) }, { status: 200, headers });
}
