/**
 * POST /api/billing/baa/upload
 *
 * Institutional admin uploads their countersigned BAA PDF along with
 * signer metadata. Stores the PDF on the Render persistent disk, sets
 * the institution's baa_status='pending' (awaiting Dōsys countersign),
 * and triggers transactional emails to both Mario (notify) and the
 * customer (receipt).
 *
 * Auth: requireInstitutionalAdmin — only the institution's own admin
 * may upload. Multi-admin teams: any admin can submit; the last
 * upload wins (older versions are preserved on disk for audit).
 *
 * Multipart fields (FormData):
 *   - file:           the signed PDF (Blob, ≤25 MB, %PDF magic-byte check)
 *   - signer_name:    full legal name of the signing officer
 *   - signer_title:   title (e.g. "Director of Pharmacy")
 *   - signer_email:   signing officer's email (defaults to admin's if blank)
 *   - template_version: which BAA template version they signed (e.g. "v1.0-draft")
 *
 * Returns: { ok: true, status: "pending", next_step: string }
 */

import { NextResponse } from "next/server";
import { requireInstitutionalAdmin } from "@/lib/team";
import { recordBaaSubmission, logSecurityEvent } from "@/lib/db";
import { hasFeature } from "@/lib/tiers";
import { saveBaaDocument } from "@/lib/baa/storage";
import { sendBaaSubmittedEmails } from "@/lib/baa/emails";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  if (!hasFeature(gate.tier, "org.baa")) {
    return NextResponse.json(
      { error: "BAA is available on Department and Hospital plans.", required_tier: "department" },
      { status: 403 },
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
    return NextResponse.json({ error: "Missing 'file' field (must be a PDF)." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  const signerName = String(form.get("signer_name") ?? "").trim();
  const signerTitle = String(form.get("signer_title") ?? "").trim();
  const signerEmailRaw = String(form.get("signer_email") ?? "").trim();
  const templateVersion = String(form.get("template_version") ?? "").trim();

  if (!signerName) return NextResponse.json({ error: "signer_name is required." }, { status: 400 });
  if (!signerTitle) return NextResponse.json({ error: "signer_title is required." }, { status: 400 });
  if (!templateVersion) {
    return NextResponse.json({ error: "template_version is required." }, { status: 400 });
  }
  const signerEmail = signerEmailRaw || gate.user.email;

  const bytes = Buffer.from(await file.arrayBuffer());

  let storedPath: string;
  try {
    storedPath = saveBaaDocument(gate.account.id, "customer-signed", bytes);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to store BAA document." },
      { status: 400 },
    );
  }

  recordBaaSubmission(gate.account.id, {
    signer_name: signerName,
    signer_title: signerTitle,
    signer_email: signerEmail,
    document_path: storedPath,
    template_version: templateVersion,
  });

  logSecurityEvent({
    user_id: gate.user.id,
    username: gate.user.username,
    action: "BAA_SUBMITTED",
    details: JSON.stringify({
      institution_id: gate.account.id,
      institution_name: gate.account.institution_name,
      signer_name: signerName,
      signer_title: signerTitle,
      signer_email: signerEmail,
      template_version: templateVersion,
      document_path: storedPath,
      file_bytes: bytes.length,
    }),
    severity: "info",
  });

  // Fire-and-forget transactional emails. Don't block the response —
  // if SMTP is down we still want to confirm the upload succeeded.
  void sendBaaSubmittedEmails({
    institutionName: gate.account.institution_name,
    institutionId: gate.account.id,
    signerName,
    signerTitle,
    signerEmail,
    templateVersion,
    submittedAt: new Date(),
  }).catch(() => {/* logged inside the email helper */});

  return NextResponse.json({
    ok: true,
    status: "pending",
    next_step:
      "Your signed BAA has been received. The Dōsys Health LLC compliance team will countersign within one business day and email the fully-executed copy to your signer email. You can use the calculator freely while this completes; no PHI handling is gated.",
  });
}
