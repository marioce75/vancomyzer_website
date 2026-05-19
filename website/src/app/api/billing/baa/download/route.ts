/**
 * GET /api/billing/baa/download
 *
 * Generates a pre-filled BAA PDF for the calling institutional admin's
 * institution and returns it as a download. The PDF contains the
 * institution name in the parties block and signature lines for the
 * Covered Entity (customer) and Business Associate (Dōsys Health LLC).
 *
 * ━━━ APPROVAL GATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Until BAA_TEMPLATE_APPROVED=true is set in the runtime environment,
 * this endpoint refuses to serve the PDF to customers and returns
 * HTTP 503 with an explanatory message. This is the production guard
 * against customers signing a draft before the template has been
 * reviewed by counsel.
 *
 * For Mario (superadmin), the endpoint will serve the draft PDF
 * regardless of the env var — this lets him download a draft to
 * forward to his attorney for review.
 *
 * Auth: requireInstitutionalAdmin (org.baa feature gate).
 */

import { NextResponse } from "next/server";
import { requireInstitutionalAdmin } from "@/lib/team";
import { hasFeature } from "@/lib/tiers";
import { generateBaaPdf, isBaaTemplateApproved, BAA_TEMPLATE_VERSION } from "@/lib/baa/template";
import { toBlobPart } from "@/lib/baa/storage";

export async function GET() {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  if (!hasFeature(gate.tier, "org.baa")) {
    return NextResponse.json(
      { error: "BAA is available on Department and Hospital plans.", required_tier: "department" },
      { status: 403 },
    );
  }

  const isSuperadmin = gate.user.role === "admin";
  if (!isBaaTemplateApproved() && !isSuperadmin) {
    return NextResponse.json(
      {
        error:
          "The Vancomyzer BAA template is under attorney review and not yet available for customer signing. Please contact contact@dosys.health to request the BAA via the manual process while the self-serve template is finalized.",
        template_version: BAA_TEMPLATE_VERSION,
        approval_pending: true,
      },
      { status: 503 },
    );
  }

  const pdfBytes = await generateBaaPdf({
    institutionName: gate.account.institution_name,
    generatedAt: new Date(),
  });

  const safeName = gate.account.institution_name.replace(/[^A-Za-z0-9_-]+/g, "_");
  const filename = `Vancomyzer-BAA-${safeName}-${BAA_TEMPLATE_VERSION}.pdf`;

  return new NextResponse(new Blob([toBlobPart(pdfBytes)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-BAA-Template-Version": BAA_TEMPLATE_VERSION,
      "X-BAA-Template-Approved": isBaaTemplateApproved() ? "true" : "false",
    },
  });
}
