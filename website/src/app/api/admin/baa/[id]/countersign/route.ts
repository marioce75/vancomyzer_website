/**
 * POST /api/admin/baa/[id]/countersign
 * GET  /api/admin/baa/[id]/customer-pdf
 *
 * Superadmin (system role 'admin') endpoints for executing customer-
 * submitted BAAs.
 *
 *   POST: Multipart upload of Dōsys's countersigned PDF. Stores the
 *         fully-executed copy, flips baa_status='active', stamps
 *         baa_countersigned_at, and emails the customer's signer.
 *
 *   GET:  Streams the customer-submitted PDF back to Mario so he can
 *         download, countersign in his preferred tool, and re-upload.
 *
 * Auth: system superadmin only (users.role='admin'). The
 * institutional-admin gate is NOT sufficient — institutional admins
 * may sign as the Covered Entity but cannot countersign as the
 * Business Associate.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  getInstitutionalAccount,
  recordBaaCountersign,
  logSecurityEvent,
  findUserByLogin,
} from "@/lib/db";
import { saveBaaDocument, readBaaDocument, baaDocumentExists, toBlobPart } from "@/lib/baa/storage";
import { sendBaaExecutedEmail } from "@/lib/baa/emails";

interface Ctx {
  params: { id: string };
}

async function requireSuperadmin(): Promise<{ ok: true; email: string; userId: number; username: string } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const role = (session?.user as Record<string, unknown>)?.role;
  if (role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Superadmin only." }, { status: 403 }) };
  }
  const dbUser = findUserByLogin(email);
  if (!dbUser) {
    return { ok: false, response: NextResponse.json({ error: "User not found." }, { status: 404 }) };
  }
  return { ok: true, email, userId: dbUser.id, username: dbUser.username };
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(req: Request, { params }: Ctx) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;

  const institutionId = parseId(params.id);
  if (institutionId == null) {
    return NextResponse.json({ error: "Invalid institution id." }, { status: 400 });
  }

  const account = getInstitutionalAccount(institutionId);
  if (!account) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 });
  }
  if (account.baa_status !== "pending") {
    return NextResponse.json(
      {
        error: `Cannot countersign — institution BAA is in state '${account.baa_status}', expected 'pending'.`,
      },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing 'file' field — upload the countersigned PDF." },
      { status: 400 },
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  let executedPath: string;
  try {
    executedPath = saveBaaDocument(institutionId, "fully-executed", bytes);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to store countersigned BAA." },
      { status: 400 },
    );
  }

  recordBaaCountersign(institutionId, executedPath);

  logSecurityEvent({
    user_id: gate.userId,
    username: gate.username,
    action: "BAA_COUNTERSIGNED",
    details: JSON.stringify({
      institution_id: institutionId,
      institution_name: account.institution_name,
      executed_document_path: executedPath,
      previous_customer_document_path: account.baa_document_path,
      file_bytes: bytes.length,
    }),
    severity: "info",
  });

  if (account.baa_signer_email) {
    void sendBaaExecutedEmail({
      institutionName: account.institution_name,
      signerName: account.baa_signer_name ?? "Signer",
      signerEmail: account.baa_signer_email,
      countersignedAt: new Date(),
      executedPdfBytes: bytes,
    }).catch(() => {/* logged inside helper */});
  }

  return NextResponse.json({
    ok: true,
    status: "active",
    institution_id: institutionId,
    countersigned_at: new Date().toISOString(),
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;

  const institutionId = parseId(params.id);
  if (institutionId == null) {
    return NextResponse.json({ error: "Invalid institution id." }, { status: 400 });
  }

  const account = getInstitutionalAccount(institutionId);
  if (!account || !account.baa_document_path) {
    return NextResponse.json({ error: "No BAA document on file." }, { status: 404 });
  }
  if (!baaDocumentExists(account.baa_document_path)) {
    return NextResponse.json({ error: "BAA document path is broken." }, { status: 500 });
  }

  const bytes = readBaaDocument(account.baa_document_path);
  const safeName = account.institution_name.replace(/[^A-Za-z0-9_-]+/g, "_");
  const filename = `Vancomyzer-BAA-CustomerSigned-${safeName}.pdf`;

  return new NextResponse(new Blob([toBlobPart(bytes)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
