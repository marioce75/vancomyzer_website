/**
 * GET /api/billing/baa/status
 *
 * Returns the current BAA state for the calling institutional admin's
 * institution. Used by the /team UI to render the BAA card.
 *
 * Auth: requireInstitutionalAdmin.
 *
 * Response shape (the UI switches on `status`):
 *   {
 *     status: 'not_requested' | 'pending' | 'active',
 *     submitted_at?: string,         // when customer uploaded
 *     executed_at?: string,          // when Dōsys countersigned
 *     signer?: { name, title, email },
 *     template_version?: string,
 *     template_approved: boolean,    // false → download endpoint will refuse
 *     download_available: boolean,   // true once template is approved
 *     executed_pdf_available: boolean // true once active + countersigned PDF on disk
 *   }
 */

import { NextResponse } from "next/server";
import { requireInstitutionalAdmin } from "@/lib/team";
import { hasFeature } from "@/lib/tiers";
import { baaDocumentExists } from "@/lib/baa/storage";
import { isBaaTemplateApproved } from "@/lib/baa/template";

export async function GET() {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  if (!hasFeature(gate.tier, "org.baa")) {
    return NextResponse.json(
      { error: "BAA is available on Department and Hospital plans.", required_tier: "department" },
      { status: 403 },
    );
  }

  const a = gate.account;
  const templateApproved = isBaaTemplateApproved();

  return NextResponse.json({
    status: a.baa_status,
    submitted_at: a.baa_signed_at,
    executed_at: a.baa_countersigned_at,
    signer: a.baa_signer_name
      ? {
          name: a.baa_signer_name,
          title: a.baa_signer_title,
          email: a.baa_signer_email,
        }
      : null,
    template_version: a.baa_template_version,
    template_approved: templateApproved,
    download_available: templateApproved,
    executed_pdf_available:
      a.baa_status === "active" && baaDocumentExists(a.baa_document_path),
  });
}
