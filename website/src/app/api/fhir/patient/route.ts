import { NextRequest, NextResponse } from "next/server";
import { fetchAllVancomycinData, type SmartContext } from "@/lib/fhir";

/**
 * POST /api/fhir/patient — Fetch all vancomycin-relevant FHIR data for the current patient.
 *
 * Expects the SMART context (fhirServerUrl, patientId, accessToken) in the request body.
 * Returns aggregated patient demographics, weight, SCr, vancomycin levels, and medication orders.
 *
 * This runs server-side so the FHIR access token is not exposed in browser network requests
 * (if CORS policies on the FHIR server block direct browser calls).
 */
export async function POST(request: NextRequest) {
  let body: { fhirServerUrl: string; patientId: string; accessToken: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { fhirServerUrl, patientId, accessToken } = body;

  if (!fhirServerUrl || !patientId || !accessToken) {
    return NextResponse.json({ error: "Missing SMART context (fhirServerUrl, patientId, accessToken)." }, { status: 400 });
  }

  const ctx: SmartContext = { fhirServerUrl, patientId, accessToken };

  try {
    const data = await fetchAllVancomycinData(ctx);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[FHIR] Patient data fetch error:", err);
    return NextResponse.json(
      { error: `Failed to fetch patient data: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
