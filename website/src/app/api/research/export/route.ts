import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  listResearchPatients,
  getDosingRecords,
  getLevelRecords,
  getScrTrajectory,
  logResearchAction,
} from "@/lib/research/db";
import {
  buildNonmemRows,
  validateNonmemDataset,
  exportToCsv,
  buildCohortSummary,
} from "@/lib/research/nonmemExport";

// GET: generate NONMEM CSV export or cohort summary
export async function GET(request: NextRequest) {
  const admin = await requireResearchAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const filter = request.nextUrl.searchParams.get("filter") ?? "all";
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  // Fetch all patients
  let patients = listResearchPatients();

  // Apply filter
  if (filter === "eligible") {
    patients = patients.filter(p => p.meets_inclusion === 1);
  } else if (filter === "obesity") {
    patients = patients.filter(p => p.meets_inclusion === 1 && p.bmi >= 40);
  }

  if (patients.length === 0) {
    return NextResponse.json({ error: "No patients match the filter criteria." }, { status: 404 });
  }

  // JSON summary mode
  if (format === "summary") {
    const summary = buildCohortSummary(patients);

    logResearchAction(
      admin.username,
      "export_summary",
      null,
      JSON.stringify({ filter, n_patients: patients.length })
    );

    return NextResponse.json({ filter, summary });
  }

  // CSV export mode — build NONMEM dataset
  const allDoses = new Map<string, ReturnType<typeof getDosingRecords>>();
  const allLevels = new Map<string, ReturnType<typeof getLevelRecords>>();
  const allScr = new Map<string, ReturnType<typeof getScrTrajectory>>();

  for (const patient of patients) {
    allDoses.set(patient.study_id, getDosingRecords(patient.study_id));
    allLevels.set(patient.study_id, getLevelRecords(patient.study_id));
    allScr.set(patient.study_id, getScrTrajectory(patient.study_id));
  }

  const rows = buildNonmemRows(patients, allDoses, allLevels, allScr);

  // Validate before returning
  const validation = validateNonmemDataset(rows);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "NONMEM dataset validation failed.",
        validation_errors: validation.errors,
      },
      { status: 400 }
    );
  }

  const csv = exportToCsv(rows);

  logResearchAction(
    admin.username,
    "export_csv",
    null,
    JSON.stringify({ filter, n_patients: patients.length, n_rows: rows.length })
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="vancomyzer_nonmem_${filter}_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
