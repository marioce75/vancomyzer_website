/**
 * Batch formats for the timed-draw study workflow (pure: strings in, strings out).
 *
 * Input, either
 *   - JSON: { "schema": "vancomyzer-hca-timed-draw", "schema_version": 1, "cases": [TimedCaseInput, ...] }
 *   - CSV pair: cases.csv (one row per case) + doses.csv (one row per dose, keyed by study_case_id)
 * Output: predictions CSV and JSON with one row per input case, in input order.
 *
 * Any column or key that is not in the field dictionary is refused for the
 * whole file; a column that looks like a measured result is refused with
 * MEASURED_RESULT_SUPPLIED. See docs/study-hca/FIELD_DICTIONARY.md.
 */
import {
  ALLOWED_CASE_FIELDS,
  ALLOWED_DOSE_FIELDS,
  predictAtDraw,
  screenFieldName,
  type Reason,
  type TimedPredictionResult,
} from "./predictAtDraw";

export const BATCH_SCHEMA = "vancomyzer-hca-timed-draw";
export const BATCH_SCHEMA_VERSION = 1;
export const MAX_CASES = 20_000;

export class BatchFormatError extends Error {
  constructor(public readonly reasons: Reason[]) {
    super(reasons.map((r) => `${r.code}: ${r.message}`).join("\n"));
  }
}

// ── CSV (RFC 4180 subset: comma, double-quote escaping, CRLF or LF) ─────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // BOM
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      if (field.length) throw new BatchFormatError([{ code: "CSV_SYNTAX", message: `Unexpected quote in an unquoted field near character ${i}.` }]);
      quoted = true;
    } else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (quoted) throw new BatchFormatError([{ code: "CSV_SYNTAX", message: "Unterminated quoted field." }]);
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function table(text: string, allowed: ReadonlySet<string>, scope: string, required: string[]): Record<string, string>[] {
  const rows = parseCsv(text);
  if (!rows.length) throw new BatchFormatError([{ code: "EMPTY_FILE", message: `${scope} file is empty.` }]);
  const header = rows[0].map((h) => h.trim());
  const reasons: Reason[] = [];
  const seen = new Set<string>();
  for (const h of header) {
    const r = screenFieldName(h, allowed, `${scope} column`);
    if (r) reasons.push(r);
    if (seen.has(h)) reasons.push({ code: "DUPLICATE_COLUMN", message: `${scope} column "${h}" appears twice.` });
    seen.add(h);
  }
  for (const req of required) if (!seen.has(req)) reasons.push({ code: "MISSING_COLUMN", message: `${scope} file needs a "${req}" column.` });
  if (reasons.length) throw new BatchFormatError(reasons);
  return rows.slice(1).map((r, i) => {
    if (r.length !== header.length) throw new BatchFormatError([{ code: "CSV_ROW_WIDTH", message: `${scope} row ${i + 2} has ${r.length} cells; the header has ${header.length}.` }]);
    return Object.fromEntries(header.map((h, j) => [h, r[j].trim()]));
  });
}

const NUMERIC_CASE = ["age_years", "weight_kg", "serum_creatinine_mg_dl"];
const BOOLEAN_CASE = ["renal_replacement_therapy", "history_complete_attested"];
const TIME_CASE = ["scr_collected_at", "draw_time"];

/** CSV text cell → JSON value. Empty → undefined; numbers must be plain decimals. */
function num(s: string): number | string | undefined {
  if (s === "") return undefined;
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : s; // a non-number stays a string and is refused by the validator
}
function bool(s: string): boolean | string | undefined {
  if (s === "") return undefined;
  const l = s.toLowerCase();
  return l === "true" ? true : l === "false" ? false : s;
}

/** Convert the CSV pair to the same case objects the JSON format carries. */
export function casesFromCsv(casesCsv: string, dosesCsv: string): unknown[] {
  const caseFields = new Set(Array.from(ALLOWED_CASE_FIELDS).filter((f) => f !== "doses"));
  const doseFields = new Set(["study_case_id"].concat(Array.from(ALLOWED_DOSE_FIELDS)));
  const caseRows = table(casesCsv, caseFields, "cases.csv", Array.from(caseFields));
  const doseRows = table(dosesCsv, doseFields, "doses.csv", ["study_case_id", "start", "dose_mg"]);
  const out = caseRows.map((r) => {
    const basis = r.time_basis;
    const time = (s: string) => (s === "" ? undefined : basis === "elapsed_hours" ? num(s) : s);
    const c: Record<string, unknown> = { study_case_id: r.study_case_id, time_basis: basis, doses: [] as unknown[] };
    for (const f of NUMERIC_CASE) c[f] = num(r[f]);
    for (const f of BOOLEAN_CASE) c[f] = bool(r[f]);
    for (const f of TIME_CASE) c[f] = time(r[f]);
    return c;
  });
  const byId = new Map<string, Record<string, unknown>>();
  for (const c of out) if (!byId.has(String(c.study_case_id))) byId.set(String(c.study_case_id), c);
  const orphans: Reason[] = [];
  doseRows.forEach((d, i) => {
    const c = byId.get(d.study_case_id);
    if (!c) { orphans.push({ code: "DOSE_WITHOUT_CASE", message: `doses.csv row ${i + 2} refers to study_case_id "${d.study_case_id}", which is not in cases.csv.` }); return; }
    const basis = c.time_basis;
    const time = (s: string) => (s === "" ? undefined : basis === "elapsed_hours" ? num(s) : s);
    const dose: Record<string, unknown> = { start: time(d.start), dose_mg: num(d.dose_mg) };
    if (d.infusion_minutes !== undefined && d.infusion_minutes !== "") dose.infusion_minutes = num(d.infusion_minutes);
    if (d.end !== undefined && d.end !== "") dose.end = time(d.end);
    (c.doses as unknown[]).push(dose);
  });
  if (orphans.length) throw new BatchFormatError(orphans);
  return out;
}

/** Validate the JSON envelope and return its case list. */
export function casesFromJson(text: string): unknown[] {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { throw new BatchFormatError([{ code: "JSON_SYNTAX", message: "Input is not valid JSON." }]); }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new BatchFormatError([{ code: "INVALID_ENVELOPE", message: "Top level must be an object." }]);
  const o = doc as Record<string, unknown>;
  const reasons: Reason[] = [];
  for (const k of Object.keys(o)) {
    const r = screenFieldName(k, new Set(["schema", "schema_version", "cases"]), "Batch");
    if (r) reasons.push(r);
  }
  if (o.schema !== BATCH_SCHEMA || o.schema_version !== BATCH_SCHEMA_VERSION) reasons.push({ code: "INVALID_ENVELOPE", message: `schema must be "${BATCH_SCHEMA}" and schema_version ${BATCH_SCHEMA_VERSION}.` });
  if (!Array.isArray(o.cases)) reasons.push({ code: "INVALID_ENVELOPE", message: "cases must be an array." });
  if (reasons.length) throw new BatchFormatError(reasons);
  return o.cases as unknown[];
}

/** Run every case; duplicates of a study_case_id are all refused. */
export function runBatch(cases: unknown[]): TimedPredictionResult[] {
  if (cases.length === 0) throw new BatchFormatError([{ code: "NO_CASES", message: "The batch has no cases." }]);
  if (cases.length > MAX_CASES) throw new BatchFormatError([{ code: "TOO_MANY_CASES", message: `At most ${MAX_CASES} cases per batch.` }]);
  const counts = new Map<string, number>();
  for (const c of cases) {
    const id = c && typeof c === "object" ? String((c as Record<string, unknown>).study_case_id) : "";
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return cases.map((c) => {
    const result = predictAtDraw(c);
    const id = c && typeof c === "object" ? String((c as Record<string, unknown>).study_case_id) : "";
    if ((counts.get(id) ?? 0) > 1) {
      return {
        ...result,
        status: "refused" as const,
        predicted_concentration_mg_l: null,
        draw_elapsed_hours: null,
        doses_used: 0,
        model_parameters: null,
        reasons: [...result.reasons, { code: "DUPLICATE_STUDY_CASE_ID", message: `study_case_id "${id}" appears more than once in the batch.` }],
      };
    }
    return result;
  });
}

export const OUTPUT_COLUMNS = [
  "study_case_id",
  "status",
  "draw_time",
  "draw_elapsed_hours",
  "predicted_concentration_mg_l",
  "doses_used",
  "warnings",
  "reasons",
  "release",
] as const;

/** Numbers are written unrounded (shortest round-trip decimal). */
export function resultsToCsv(results: TimedPredictionResult[]): string {
  const lines = [OUTPUT_COLUMNS.join(",")];
  for (const r of results) {
    const fmt = (list: Reason[]) => list.map((x) => `${x.code}: ${x.message}`).join(" | ");
    lines.push([
      r.study_case_id, r.status, r.draw_time, r.draw_elapsed_hours, r.predicted_concentration_mg_l,
      r.doses_used, fmt(r.warnings), fmt(r.reasons), r.release,
    ].map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}
