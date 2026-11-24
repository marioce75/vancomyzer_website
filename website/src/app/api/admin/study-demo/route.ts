import { NextRequest, NextResponse } from "next/server";
import { isStudyDemoOwner } from "@/lib/studyDemo/requireOwner";
import { FICTIONAL_CASES } from "@/lib/studyTimed/fictionalCases";
import { predictAtDraw } from "@/lib/studyTimed/predictAtDraw";
import { FICTIONAL_LAB_RESULTS_MG_L } from "@/lib/studyDemo/fictionalOutcomes";
import { RELEASE_LABEL } from "@/lib/studyTimed/release";

/**
 * Owner-only research demo. Preloaded fictional cases only: the request names
 * a case ID from the fixed list and an action; it can carry no patient data.
 * Nothing is stored, exported or logged. Every non-owner gets the same 404 as
 * a route that does not exist.
 */
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow" };
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404, headers: NO_STORE });
const BANNER = "Fictional case only • Research demo • Not for patient care";

export async function GET() {
  if (!(await isStudyDemoOwner())) return notFound();
  return NextResponse.json(
    {
      banner: BANNER,
      release: RELEASE_LABEL,
      cases: FICTIONAL_CASES.map((c) => ({ id: c.input.study_case_id, title: c.title, story: c.story, input: c.input })),
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: NextRequest) {
  if (!(await isStudyDemoOwner())) return notFound();
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > 1024) return NextResponse.json({ error: "Request too large." }, { status: 413, headers: NO_STORE });
  let body: unknown;
  try { body = JSON.parse((await request.text()).slice(0, 1024)); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers: NO_STORE }); }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o || Object.keys(o).some((k) => k !== "case_id" && k !== "action")) {
    return NextResponse.json({ error: "Only {case_id, action} is accepted. The demo runs preloaded fictional cases only." }, { status: 400, headers: NO_STORE });
  }
  const fc = FICTIONAL_CASES.find((c) => c.input.study_case_id === o.case_id);
  if (!fc) return NextResponse.json({ error: "Unknown fictional case." }, { status: 400, headers: NO_STORE });
  if (o.action === "predict") {
    return NextResponse.json({ banner: BANNER, case_id: fc.input.study_case_id, result: predictAtDraw(fc.input) }, { headers: NO_STORE });
  }
  if (o.action === "reveal") {
    return NextResponse.json({ banner: BANNER, case_id: fc.input.study_case_id, fictional_lab_result_mg_l: FICTIONAL_LAB_RESULTS_MG_L[fc.input.study_case_id] ?? null }, { headers: NO_STORE });
  }
  return NextResponse.json({ error: 'action must be "predict" or "reveal".' }, { status: 400, headers: NO_STORE });
}
