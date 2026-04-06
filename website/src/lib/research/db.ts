/**
 * Research Mode database layer — separate tables in the same SQLite file.
 * Uses the existing db proxy from src/lib/db.ts.
 *
 * Tables are created lazily on first access (same pattern as the main db).
 */

import db from "@/lib/db";
import type {
  ResearchPatient,
  ScrTrajectoryPoint,
  DosingRecord,
  LevelRecord,
  ClinicalOutcome,
  ConcomitantNephrotoxin,
  ResearchAuditEntry,
} from "@/types/research";

// ---------------------------------------------------------------------------
// Schema initialization (idempotent)
// ---------------------------------------------------------------------------

let _initialized = false;

export function ensureResearchTables(): void {
  if (_initialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS research_patients (
      study_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL DEFAULT 'HCA-GC-01',
      age INTEGER NOT NULL,
      sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
      ethnicity TEXT NOT NULL DEFAULT 'unknown' CHECK (ethnicity IN ('hispanic', 'non-hispanic', 'unknown')),
      weight_kg REAL NOT NULL,
      height_cm REAL NOT NULL,
      bmi REAL NOT NULL,
      ffm_kg REAL NOT NULL,
      ibw_kg REAL NOT NULL,
      adjbw_kg REAL,
      scr_baseline REAL NOT NULL,
      crcl_baseline REAL NOT NULL,
      icu_admission INTEGER NOT NULL DEFAULT 0,
      indication TEXT NOT NULL DEFAULT 'empiric',
      bedbound INTEGER NOT NULL DEFAULT 0,
      rrt INTEGER NOT NULL DEFAULT 0,
      enrollment_date TEXT NOT NULL,
      meets_inclusion INTEGER NOT NULL DEFAULT 0,
      exclusion_reasons TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scr_trajectory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id TEXT NOT NULL REFERENCES research_patients(study_id),
      scr_mg_dl REAL NOT NULL,
      time_hours REAL NOT NULL,
      crcl_ml_min REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dosing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id TEXT NOT NULL REFERENCES research_patients(study_id),
      dose_mg REAL NOT NULL,
      infusion_duration_min REAL NOT NULL,
      infusion_rate_mg_h REAL NOT NULL,
      time_hours REAL NOT NULL,
      is_loading_dose INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS level_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id TEXT NOT NULL REFERENCES research_patients(study_id),
      concentration_mcg_ml REAL NOT NULL,
      time_hours REAL NOT NULL,
      during_infusion INTEGER NOT NULL DEFAULT 0,
      in_distribution_phase INTEGER NOT NULL DEFAULT 0,
      time_since_infusion_end_h REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clinical_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id TEXT NOT NULL UNIQUE REFERENCES research_patients(study_id),
      aki_detected INTEGER NOT NULL DEFAULT 0,
      aki_stage INTEGER,
      aki_onset_day INTEGER,
      hospital_los_days INTEGER,
      vanc_discontinued_early INTEGER NOT NULL DEFAULT 0,
      discontinuation_reason TEXT,
      microbiological_outcome TEXT CHECK (microbiological_outcome IN ('eradicated', 'persistent', 'unknown'))
    );

    CREATE TABLE IF NOT EXISTS concomitant_nephrotoxins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_id TEXT NOT NULL REFERENCES research_patients(study_id),
      drug_name TEXT NOT NULL,
      vasopressor_use INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS research_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      study_id TEXT,
      fields_changed TEXT NOT NULL DEFAULT '{}'
    );
  `);

  _initialized = true;
}

// ---------------------------------------------------------------------------
// Study ID generation
// ---------------------------------------------------------------------------

export function generateStudyId(): string {
  ensureResearchTables();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM research_patients").get() as { cnt: number };
  const next = (row?.cnt ?? 0) + 1;
  return `RS-${String(next).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Research Patients
// ---------------------------------------------------------------------------

export function insertResearchPatient(patient: Omit<ResearchPatient, "created_at" | "updated_at">): void {
  ensureResearchTables();
  db.prepare(`
    INSERT INTO research_patients (study_id, site_id, age, sex, ethnicity, weight_kg, height_cm,
      bmi, ffm_kg, ibw_kg, adjbw_kg, scr_baseline, crcl_baseline, icu_admission, indication,
      bedbound, rrt, enrollment_date, meets_inclusion, exclusion_reasons, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patient.study_id, patient.site_id, patient.age, patient.sex, patient.ethnicity,
    patient.weight_kg, patient.height_cm, patient.bmi, patient.ffm_kg, patient.ibw_kg,
    patient.adjbw_kg, patient.scr_baseline, patient.crcl_baseline, patient.icu_admission,
    patient.indication, patient.bedbound, patient.rrt, patient.enrollment_date,
    patient.meets_inclusion, patient.exclusion_reasons, patient.created_by
  );
}

export function updateResearchPatient(study_id: string, fields: Partial<ResearchPatient>): void {
  ensureResearchTables();
  const allowed = [
    "site_id", "age", "sex", "ethnicity", "weight_kg", "height_cm", "bmi", "ffm_kg",
    "ibw_kg", "adjbw_kg", "scr_baseline", "crcl_baseline", "icu_admission", "indication",
    "bedbound", "rrt", "enrollment_date", "meets_inclusion", "exclusion_reasons",
  ];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = ?`);
      values.push((fields as Record<string, unknown>)[key]);
    }
  }
  if (updates.length === 0) return;
  updates.push("updated_at = datetime('now')");
  values.push(study_id);
  db.prepare(`UPDATE research_patients SET ${updates.join(", ")} WHERE study_id = ?`).run(...values);
}

export function getResearchPatient(study_id: string): ResearchPatient | undefined {
  ensureResearchTables();
  return db.prepare("SELECT * FROM research_patients WHERE study_id = ?").get(study_id) as ResearchPatient | undefined;
}

export function listResearchPatients(): ResearchPatient[] {
  ensureResearchTables();
  return db.prepare("SELECT * FROM research_patients ORDER BY created_at DESC").all() as ResearchPatient[];
}

export function deleteResearchPatient(study_id: string): void {
  ensureResearchTables();
  db.prepare("DELETE FROM concomitant_nephrotoxins WHERE study_id = ?").run(study_id);
  db.prepare("DELETE FROM clinical_outcomes WHERE study_id = ?").run(study_id);
  db.prepare("DELETE FROM level_records WHERE study_id = ?").run(study_id);
  db.prepare("DELETE FROM dosing_records WHERE study_id = ?").run(study_id);
  db.prepare("DELETE FROM scr_trajectory WHERE study_id = ?").run(study_id);
  db.prepare("DELETE FROM research_patients WHERE study_id = ?").run(study_id);
}

// ---------------------------------------------------------------------------
// SCr Trajectory
// ---------------------------------------------------------------------------

export function insertScrPoint(point: Omit<ScrTrajectoryPoint, "id">): void {
  ensureResearchTables();
  db.prepare("INSERT INTO scr_trajectory (study_id, scr_mg_dl, time_hours, crcl_ml_min) VALUES (?, ?, ?, ?)").run(
    point.study_id, point.scr_mg_dl, point.time_hours, point.crcl_ml_min
  );
}

export function getScrTrajectory(study_id: string): ScrTrajectoryPoint[] {
  ensureResearchTables();
  return db.prepare("SELECT * FROM scr_trajectory WHERE study_id = ? ORDER BY time_hours ASC").all(study_id) as ScrTrajectoryPoint[];
}

export function deleteScrPoint(id: number): void {
  ensureResearchTables();
  db.prepare("DELETE FROM scr_trajectory WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Dosing Records
// ---------------------------------------------------------------------------

export function insertDosingRecord(record: Omit<DosingRecord, "id">): void {
  ensureResearchTables();
  db.prepare(`INSERT INTO dosing_records (study_id, dose_mg, infusion_duration_min, infusion_rate_mg_h, time_hours, is_loading_dose)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    record.study_id, record.dose_mg, record.infusion_duration_min, record.infusion_rate_mg_h,
    record.time_hours, record.is_loading_dose
  );
}

export function getDosingRecords(study_id: string): DosingRecord[] {
  ensureResearchTables();
  return db.prepare("SELECT * FROM dosing_records WHERE study_id = ? ORDER BY time_hours ASC").all(study_id) as DosingRecord[];
}

export function deleteDosingRecord(id: number): void {
  ensureResearchTables();
  db.prepare("DELETE FROM dosing_records WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Level Records
// ---------------------------------------------------------------------------

export function insertLevelRecord(record: Omit<LevelRecord, "id">): void {
  ensureResearchTables();
  db.prepare(`INSERT INTO level_records (study_id, concentration_mcg_ml, time_hours, during_infusion,
    in_distribution_phase, time_since_infusion_end_h) VALUES (?, ?, ?, ?, ?, ?)`).run(
    record.study_id, record.concentration_mcg_ml, record.time_hours,
    record.during_infusion, record.in_distribution_phase, record.time_since_infusion_end_h
  );
}

export function getLevelRecords(study_id: string): LevelRecord[] {
  ensureResearchTables();
  return db.prepare("SELECT * FROM level_records WHERE study_id = ? ORDER BY time_hours ASC").all(study_id) as LevelRecord[];
}

export function deleteLevelRecord(id: number): void {
  ensureResearchTables();
  db.prepare("DELETE FROM level_records WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Clinical Outcomes
// ---------------------------------------------------------------------------

export function upsertClinicalOutcome(outcome: Omit<ClinicalOutcome, "id">): void {
  ensureResearchTables();
  db.prepare(`INSERT INTO clinical_outcomes (study_id, aki_detected, aki_stage, aki_onset_day,
    hospital_los_days, vanc_discontinued_early, discontinuation_reason, microbiological_outcome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(study_id) DO UPDATE SET
      aki_detected = excluded.aki_detected, aki_stage = excluded.aki_stage,
      aki_onset_day = excluded.aki_onset_day, hospital_los_days = excluded.hospital_los_days,
      vanc_discontinued_early = excluded.vanc_discontinued_early,
      discontinuation_reason = excluded.discontinuation_reason,
      microbiological_outcome = excluded.microbiological_outcome
  `).run(
    outcome.study_id, outcome.aki_detected, outcome.aki_stage, outcome.aki_onset_day,
    outcome.hospital_los_days, outcome.vanc_discontinued_early,
    outcome.discontinuation_reason, outcome.microbiological_outcome
  );
}

export function getClinicalOutcome(study_id: string): ClinicalOutcome | undefined {
  ensureResearchTables();
  return db.prepare("SELECT * FROM clinical_outcomes WHERE study_id = ?").get(study_id) as ClinicalOutcome | undefined;
}

// ---------------------------------------------------------------------------
// Concomitant Nephrotoxins
// ---------------------------------------------------------------------------

export function insertNephrotoxin(record: Omit<ConcomitantNephrotoxin, "id">): void {
  ensureResearchTables();
  db.prepare("INSERT INTO concomitant_nephrotoxins (study_id, drug_name, vasopressor_use) VALUES (?, ?, ?)").run(
    record.study_id, record.drug_name, record.vasopressor_use
  );
}

export function getNephrotoxins(study_id: string): ConcomitantNephrotoxin[] {
  ensureResearchTables();
  return db.prepare("SELECT * FROM concomitant_nephrotoxins WHERE study_id = ?").all(study_id) as ConcomitantNephrotoxin[];
}

export function deleteNephrotoxin(id: number): void {
  ensureResearchTables();
  db.prepare("DELETE FROM concomitant_nephrotoxins WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Research Audit Log (append-only — no delete function)
// ---------------------------------------------------------------------------

export function logResearchAction(
  user_id: string,
  action: string,
  study_id: string | null,
  fields_changed: string
): void {
  ensureResearchTables();
  db.prepare("INSERT INTO research_audit_log (user_id, action, study_id, fields_changed) VALUES (?, ?, ?, ?)").run(
    user_id, action, study_id, fields_changed
  );
}

export function getResearchAuditLog(limit = 500): ResearchAuditEntry[] {
  ensureResearchTables();
  return db.prepare("SELECT * FROM research_audit_log ORDER BY timestamp DESC LIMIT ?").all(limit) as ResearchAuditEntry[];
}

// ---------------------------------------------------------------------------
// Summary queries
// ---------------------------------------------------------------------------

export function getResearchSummary() {
  ensureResearchTables();
  const total = (db.prepare("SELECT COUNT(*) as cnt FROM research_patients").get() as { cnt: number }).cnt;
  const eligible = (db.prepare("SELECT COUNT(*) as cnt FROM research_patients WHERE meets_inclusion = 1").get() as { cnt: number }).cnt;
  const excluded = total - eligible;
  const obesity = (db.prepare("SELECT COUNT(*) as cnt FROM research_patients WHERE bmi >= 40 AND meets_inclusion = 1").get() as { cnt: number }).cnt;
  const totalLevels = (db.prepare("SELECT COUNT(*) as cnt FROM level_records").get() as { cnt: number }).cnt;
  const totalDoses = (db.prepare("SELECT COUNT(*) as cnt FROM dosing_records").get() as { cnt: number }).cnt;

  return { total, eligible, excluded, obesity, totalLevels, totalDoses };
}
