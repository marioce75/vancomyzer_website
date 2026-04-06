/**
 * NONMEM dataset export engine.
 *
 * Generates correctly formatted CSV for population PK analysis.
 * One row per event (dose or observation) per patient, sorted by TIME.
 */

import type {
  ResearchPatient,
  DosingRecord,
  LevelRecord,
  ScrTrajectoryPoint,
  NonmemRow,
} from "@/types/research";

// ---------------------------------------------------------------------------
// Row construction
// ---------------------------------------------------------------------------

function interpolateScr(trajectory: ScrTrajectoryPoint[], time_hours: number): number {
  if (trajectory.length === 0) return 0;
  if (trajectory.length === 1) return trajectory[0].scr_mg_dl;

  const sorted = [...trajectory].sort((a, b) => a.time_hours - b.time_hours);

  // Before first measurement
  if (time_hours <= sorted[0].time_hours) return sorted[0].scr_mg_dl;
  // After last measurement
  if (time_hours >= sorted[sorted.length - 1].time_hours) return sorted[sorted.length - 1].scr_mg_dl;

  // Linear interpolation
  for (let i = 1; i < sorted.length; i++) {
    if (time_hours <= sorted[i].time_hours) {
      const t0 = sorted[i - 1].time_hours;
      const t1 = sorted[i].time_hours;
      const s0 = sorted[i - 1].scr_mg_dl;
      const s1 = sorted[i].scr_mg_dl;
      const frac = (time_hours - t0) / (t1 - t0 || 1);
      return s0 + frac * (s1 - s0);
    }
  }
  return sorted[sorted.length - 1].scr_mg_dl;
}

function interpolateCrcl(trajectory: ScrTrajectoryPoint[], time_hours: number): number {
  if (trajectory.length === 0) return 0;
  if (trajectory.length === 1) return trajectory[0].crcl_ml_min;

  const sorted = [...trajectory].sort((a, b) => a.time_hours - b.time_hours);
  if (time_hours <= sorted[0].time_hours) return sorted[0].crcl_ml_min;
  if (time_hours >= sorted[sorted.length - 1].time_hours) return sorted[sorted.length - 1].crcl_ml_min;

  for (let i = 1; i < sorted.length; i++) {
    if (time_hours <= sorted[i].time_hours) {
      const t0 = sorted[i - 1].time_hours;
      const t1 = sorted[i].time_hours;
      const c0 = sorted[i - 1].crcl_ml_min;
      const c1 = sorted[i].crcl_ml_min;
      const frac = (time_hours - t0) / (t1 - t0 || 1);
      return c0 + frac * (c1 - c0);
    }
  }
  return sorted[sorted.length - 1].crcl_ml_min;
}

function getObesityClass(bmi: number): number {
  if (bmi >= 40) return 3;
  if (bmi >= 30) return 2;
  return 1;
}

export function buildNonmemRows(
  patients: ResearchPatient[],
  allDoses: Map<string, DosingRecord[]>,
  allLevels: Map<string, LevelRecord[]>,
  allScr: Map<string, ScrTrajectoryPoint[]>
): NonmemRow[] {
  const rows: NonmemRow[] = [];

  patients.forEach((patient, patientIndex) => {
    const id = patientIndex + 1; // Sequential integer for NONMEM
    const doses = allDoses.get(patient.study_id) ?? [];
    const levels = allLevels.get(patient.study_id) ?? [];
    const scrTraj = allScr.get(patient.study_id) ?? [];

    const baseRow = {
      ID: id,
      AGE: patient.age,
      WT: patient.weight_kg,
      HT: patient.height_cm,
      BMI: Math.round(patient.bmi * 10) / 10,
      FFM: Math.round(patient.ffm_kg * 10) / 10,
      IBW: Math.round(patient.ibw_kg * 10) / 10,
      SEX: patient.sex === "male" ? 1 : 0,
      ICU: patient.icu_admission,
      OBS_CLASS: getObesityClass(patient.bmi),
      HISP: patient.ethnicity === "hispanic" ? 1 : 0,
      ARC: patient.crcl_baseline > 150 ? 1 : 0,
      SITE: patient.site_id,
    };

    // Dose events
    for (const dose of doses) {
      const scri = scrTraj.length > 0 ? interpolateScr(scrTraj, dose.time_hours) : patient.scr_baseline;
      const crcl = scrTraj.length > 0 ? interpolateCrcl(scrTraj, dose.time_hours) : patient.crcl_baseline;

      rows.push({
        ...baseRow,
        TIME: Math.round(dose.time_hours * 1000) / 1000,
        DV: 0,
        AMT: dose.dose_mg,
        RATE: dose.infusion_rate_mg_h,
        EVID: 1,
        MDV: 1,
        CMT: 1,
        SCRI: Math.round(scri * 100) / 100,
        CRCL: Math.round(crcl * 10) / 10,
      });
    }

    // Observation events
    for (const level of levels) {
      const scri = scrTraj.length > 0 ? interpolateScr(scrTraj, level.time_hours) : patient.scr_baseline;
      const crcl = scrTraj.length > 0 ? interpolateCrcl(scrTraj, level.time_hours) : patient.crcl_baseline;

      rows.push({
        ...baseRow,
        TIME: Math.round(level.time_hours * 1000) / 1000,
        DV: level.concentration_mcg_ml,
        AMT: 0,
        RATE: 0,
        EVID: 0,
        MDV: 0,
        CMT: 1,
        SCRI: Math.round(scri * 100) / 100,
        CRCL: Math.round(crcl * 10) / 10,
      });
    }
  });

  // Sort: by ID, then by TIME within each patient
  rows.sort((a, b) => a.ID - b.ID || a.TIME - b.TIME);

  return rows;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: { row: number; column: string; message: string }[];
}

export function validateNonmemDataset(rows: NonmemRow[]): ValidationResult {
  const errors: { row: number; column: string; message: string }[] = [];

  let prevId = -1;
  let prevTime = -Infinity;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Reset time tracking for new patient
    if (row.ID !== prevId) {
      prevId = row.ID;
      prevTime = -Infinity;
    }

    // TIME monotonically increasing within patient
    if (row.TIME < prevTime) {
      errors.push({ row: rowNum, column: "TIME", message: `TIME ${row.TIME} is not monotonically increasing (prev: ${prevTime})` });
    }
    prevTime = row.TIME;

    // EVID must be 0 or 1
    if (row.EVID !== 0 && row.EVID !== 1) {
      errors.push({ row: rowNum, column: "EVID", message: `EVID must be 0 or 1, got ${row.EVID}` });
    }

    // MDV/EVID consistency
    if (row.EVID === 1 && row.MDV !== 1) {
      errors.push({ row: rowNum, column: "MDV", message: "MDV must be 1 for dose events (EVID=1)" });
    }
    if (row.EVID === 0 && row.MDV !== 0) {
      errors.push({ row: rowNum, column: "MDV", message: "MDV must be 0 for observation events (EVID=0)" });
    }

    // DV: zero on dose rows, positive on observation rows
    if (row.EVID === 1 && row.DV !== 0) {
      errors.push({ row: rowNum, column: "DV", message: `DV must be 0 on dose rows, got ${row.DV}` });
    }
    if (row.EVID === 0 && row.DV <= 0) {
      errors.push({ row: rowNum, column: "DV", message: `DV must be positive on observation rows, got ${row.DV}` });
    }

    // AMT: positive on dose rows, zero on observation rows
    if (row.EVID === 1 && row.AMT <= 0) {
      errors.push({ row: rowNum, column: "AMT", message: `AMT must be positive on dose rows, got ${row.AMT}` });
    }
    if (row.EVID === 0 && row.AMT !== 0) {
      errors.push({ row: rowNum, column: "AMT", message: `AMT must be 0 on observation rows, got ${row.AMT}` });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// CSV generation
// ---------------------------------------------------------------------------

const NONMEM_COLUMNS = [
  "ID", "TIME", "DV", "AMT", "RATE", "EVID", "MDV", "CMT",
  "AGE", "WT", "HT", "BMI", "FFM", "IBW", "SEX",
  "SCRI", "CRCL", "ICU", "OBS_CLASS", "HISP", "ARC", "SITE",
];

export function exportToCsv(rows: NonmemRow[]): string {
  const header = NONMEM_COLUMNS.join(",");
  const dataRows = rows.map(row =>
    NONMEM_COLUMNS.map(col => (row as unknown as Record<string, unknown>)[col] ?? "").join(",")
  );
  return [header, ...dataRows].join("\n");
}

// ---------------------------------------------------------------------------
// Cohort summary statistics
// ---------------------------------------------------------------------------

export function buildCohortSummary(patients: ResearchPatient[]) {
  if (patients.length === 0) {
    return {
      n_patients: 0,
      demographics: null,
    };
  }

  const nums = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    return {
      median: sorted[Math.floor(n / 2)],
      q1: sorted[Math.floor(n / 4)],
      q3: sorted[Math.floor(3 * n / 4)],
      min: sorted[0],
      max: sorted[n - 1],
    };
  };

  return {
    n_patients: patients.length,
    demographics: {
      age: nums(patients.map(p => p.age)),
      weight_kg: nums(patients.map(p => p.weight_kg)),
      bmi: nums(patients.map(p => p.bmi)),
      ffm_kg: nums(patients.map(p => p.ffm_kg)),
      crcl: nums(patients.map(p => p.crcl_baseline)),
      scr: nums(patients.map(p => p.scr_baseline)),
    },
    counts: {
      male: patients.filter(p => p.sex === "male").length,
      female: patients.filter(p => p.sex === "female").length,
      hispanic: patients.filter(p => p.ethnicity === "hispanic").length,
      non_hispanic: patients.filter(p => p.ethnicity === "non-hispanic").length,
      icu: patients.filter(p => p.icu_admission === 1).length,
      obesity_class_1: patients.filter(p => p.bmi < 30).length,
      obesity_class_2: patients.filter(p => p.bmi >= 30 && p.bmi < 40).length,
      obesity_class_3: patients.filter(p => p.bmi >= 40).length,
    },
  };
}
