/**
 * GET /api/billing/baa/executed-pdf
 *
 * Customer-facing download of the fully-executed BAA PDF, for
 * institutional admins to keep on file. Only works once the BAA is
 * in 'active' state (i.e. Mario has countersigned and the
 * fully-executed PDF is on disk).
 *
 * Auth: requireInstitutionalAdmin (org.baa feature gate).
 */

import { NextResponse } from "next/server";
import { requireInstitutionalAdmin } from "@/lib/team";
import { hasFeature } from "@/lib/tiers";
import { baaDocumentExists, readBaaDocument, toBlobPart } from "@/lib/baa/storage";

export async function GET() {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  if (!hasFeature(gate.tier, "org.baa")) {
    return NextResponse.json(
      { error: "BAA is available on Department and Hospital plans.", required_tier: "department" },
      { status: 403 },
    );
  }

  const account = gate.account;
  if (account.baa_status !== "active") {
    return NextResponse.json(
      { error: "No executed BAA on file yet." },
      { status: 404 },
    );
  }
  if (!baaDocumentExists(account.baa_document_path)) {
    return NextResponse.json(
      { error: "Executed BAA document path is missing on disk — contact support." },
      { status: 500 },
    );
  }

  const bytes = readBaaDocument(account.baa_document_path!);
  const safeName = account.institution_name.replace(/[^A-Za-z0-9_-]+/g, "_");
  const filename = `Vancomyzer-BAA-Executed-${safeName}.pdf`;

  return new NextResponse(new Blob([toBlobPart(bytes)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
