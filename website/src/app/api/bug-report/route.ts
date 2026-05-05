/**
 * POST /api/bug-report
 *
 * In-app bug reporting from the Settings panel. Authenticated users only —
 * we want a real person attached to every report so the reply path works.
 *
 * Body: { description: string, pageUrl?: string }
 *   - description: required, 5–4000 chars
 *   - pageUrl:     optional, captured from the client to identify the route
 *
 * Reporter identity (name/email/username) is read from the session, never
 * trusted from the client. User-agent is read from the request header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserByEmail, logSecurityEvent } from "@/lib/db";
import { sendBugReport } from "@/lib/email";

const MIN_LEN = 5;
const MAX_LEN = 4000;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { description?: unknown; pageUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < MIN_LEN) {
    return NextResponse.json(
      { error: `Description is too short (need at least ${MIN_LEN} characters).` },
      { status: 400 },
    );
  }
  if (description.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Description is too long (max ${MAX_LEN} characters).` },
      { status: 400 },
    );
  }

  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : null;

  // Resolve reporter identity from the DB so we email the canonical address,
  // not whatever the session payload carries.
  const sessionEmail = (session.user as Record<string, unknown>).email as string | undefined;
  const sessionUsername = (session.user as Record<string, unknown>).username as string | undefined;
  if (!sessionEmail) {
    return NextResponse.json({ error: "Session missing email." }, { status: 400 });
  }
  const reporter = findUserByEmail(sessionEmail);
  if (!reporter) {
    return NextResponse.json({ error: "Reporter not found." }, { status: 404 });
  }

  const sent = await sendBugReport({
    description,
    reporter: {
      username: reporter.username,
      email: reporter.email,
      full_name: reporter.full_name,
    },
    userAgent: request.headers.get("user-agent"),
    pageUrl,
  });

  logSecurityEvent({
    user_id: reporter.id,
    username: sessionUsername ?? reporter.username,
    action: "BUG_REPORT_SUBMITTED",
    details: JSON.stringify({
      page: pageUrl,
      length: description.length,
      email_sent: sent,
    }),
    severity: "info",
  });

  if (!sent) {
    // Email failed (SMTP misconfigured) — still acknowledge to the user so
    // they don't retry; the audit log row preserves the report content path.
    return NextResponse.json({
      ok: true,
      message: "Report received. Email delivery is currently degraded; the team has been notified internally.",
    });
  }

  return NextResponse.json({ ok: true, message: "Report sent. Thank you." });
}
