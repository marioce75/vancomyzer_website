import { NextRequest, NextResponse } from 'next/server';
import { getPediatricAdmin } from '@/lib/pediatric/requireAdmin';
import { ACK_COOKIE_NAME, ackCookieOptions, issueAcknowledgementToken } from '@/lib/pediatric/acknowledgement';
import { PEDIATRIC_ACK_STATEMENT_VERSION } from '@/lib/pediatric/colin2019/manifest';
import { readBoundedJson, BodyTooLarge } from '@/lib/pediatric/requestBody';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/**
 * Records the per-session research acknowledgement for the signed-in admin.
 * Authorization runs before the body is read. The body must be JSON
 * {"acknowledge": true, "version": <current statement version>} so that a
 * cross-site form post cannot acknowledge on the admin's behalf.
 */
export async function POST(request: NextRequest) {
  const admin = await getPediatricAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 403, headers });
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: 'Server not configured.' }, { status: 500, headers });
  let body: unknown;
  try { body = await readBoundedJson(request); } catch (error) { if (error instanceof BodyTooLarge) return NextResponse.json({ error: 'Body exceeds 64 KB.' }, { status: 413, headers }); return NextResponse.json({ error: 'JSON body required.' }, { status: 400, headers }); }
  const b = body as { acknowledge?: unknown; version?: unknown } | null;
  if (!b || b.acknowledge !== true) return NextResponse.json({ error: 'Set "acknowledge": true to acknowledge the research statement.' }, { status: 400, headers });
  if (b.version !== PEDIATRIC_ACK_STATEMENT_VERSION) return NextResponse.json({ error: 'The research statement has changed; reload and acknowledge the current version.', version: PEDIATRIC_ACK_STATEMENT_VERSION }, { status: 409, headers });
  const { token, expiresAt } = issueAcknowledgementToken({ userId: admin.id, sessionToken: admin.sessionToken, secret });
  const res = NextResponse.json({ acknowledged: true, version: PEDIATRIC_ACK_STATEMENT_VERSION, expires_at: new Date(expiresAt).toISOString() }, { status: 200, headers });
  res.cookies.set(ACK_COOKIE_NAME, token, ackCookieOptions(expiresAt));
  console.log(`[PEDIATRIC PREVIEW] ${JSON.stringify({ event: 'acknowledged', version: PEDIATRIC_ACK_STATEMENT_VERSION })}`);
  return res;
}

/** Withdraws the acknowledgement for this session (clears the cookie). */
export async function DELETE() {
  const admin = await getPediatricAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 403, headers });
  const res = NextResponse.json({ acknowledged: false }, { status: 200, headers });
  res.cookies.set(ACK_COOKIE_NAME, '', { ...ackCookieOptions(0), maxAge: 0 });
  return res;
}
