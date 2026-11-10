/**
 * PDF Report Generator for Vancomyzer.
 *
 * Generates a clinical PK report as a print-optimized HTML document
 * that the pharmacist can save as PDF via the browser's print dialog.
 *
 * No external dependencies — uses window.print() with a styled document.
 *
 * The report is designed for inclusion in the medical record:
 * - Patient parameters (de-identified — no name/MRN)
 * - PK model used and parameters (CL, V1, Q, V2)
 * - Recommended dose, AUC24, peak, trough
 * - Clinical interpretation
 * - Assumptions and limitations
 * - Timestamp and calculator version
 *
 * Free-tier exports get a watermark + upgrade banner via the dedicated
 * lib/watermark.ts utility — gated by tier, no behavior duplication.
 */

import { type Locale, translate } from "@/localization/catalog";
import type { ExposureSummary } from "@/components/calculator/clinicalNote";
import { localizeReportMarkup } from "@/localization/reportMarkup";
import { buildExportWatermark } from "./watermark";
import {
  COLIN_2019,
  MODEL_MANIFEST_VERSION,
  VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED,
  modelDisplayName,
  modelShortName,
} from "./pk/modelRegistry";
import { fmt } from "@/lib/formatNumber";

/** Regulatory statement (short form) printed on every export. */
const REGULATORY_SHORT =
  "Not FDA-cleared or approved. Designed to meet the non-device clinical decision support criteria of FD&C Act §520(o)(1)(E); not reviewed by the FDA.";

/** Validation status printed on every export. */
const VALIDATION_STATUS =
  "Vancomyzer has not yet been validated in real patients. Its equations are checked against published values and synthetic test cases; external validation with patient data is planned.";

export interface ReportData {
  // Patient
  age: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;

  // Regimen
  mode: "initial_regimen" | "existing_regimen";
  recommendation_blocked?: string;
  regimen_is_current?: boolean;
  recommended_dose: string;
  recommended_interval_hours: number;
  recommended_infusion_duration_hours?: number;

  /** Level workflows: the dosing history as entered, in plain language (dosingHistory.ts). */
  dosing_history?: string;
  /** Level workflows: the measured levels sent to the calculation. */
  entered_levels?: Array<{ value_mg_l: number; hours_after_last_dose: number }>;
  /**
   * Only one dose given before the level. When the report shows that dose
   * (regimen_is_current), it is one dose, not a regimen: no interval is printed.
   * "suggested" is a dose that has NOT been given (the Empiric loading-dose
   * simulation): the report then never calls it given, recorded or entered.
   */
  single_dose?: { dose_mg: number; kind: "loading" | "single" | "suggested" };
  /**
   * Level workflows: the exposure of the dose(s) already given and the regimen
   * proposed (or why none is), as printed in the clinical note (clinicalNote.ts).
   */
  exposure_summary?: ExposureSummary;
  /** Level workflows: the one-level / changing renal function caution shown on screen. */
  one_level_caution?: string;
  /**
   * Level workflows: every other warning and advisory shown on screen (review
   * hold, lab timing, fit quality, steady-state check, AUC above 600 or below
   * target, infusion-rate note), with its on-screen title.
   */
  warnings?: Array<{ title: string; text: string }>;
  /** The recommendation is withheld for review; the reason is printed and no regimen is proposed. */
  review_hold?: { message: string };

  // PK Metrics
  auc24: number;
  peak: number;
  trough: number;

  /** Model id from the result's pk_parameters. Defaults to Colin 2019, the only dosing model. */
  pk_model_name?: string | null;

  // PK Parameters
  pk_parameters?: {
    CL: number;
    V1: number;
    Q: number;
    V2: number;
    used_posterior_refinement: boolean;
  };

  // Clinical text
  interpretation_summary?: string;
  assumptions?: string[];
  limitations?: string[];
  clinical_note?: string;

  // Frequency options
  frequency_options?: Array<{
    dose_mg: number;
    interval_hours: number;
    auc24: number;
    peak: number;
    trough: number;
  }>;

  // Meta
  pharmacist_name?: string;
  pharmacist_email?: string;
  institution?: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Model name, citation and manifest version for the report's Model section (HTML-escaped). */
function modelMethodsHtml(modelId: string | null | undefined): string {
  if (modelId === VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED.id) {
    return escapeHtml(
      `${VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED.displayName}. It was not a published or externally validated model; these values are historical and were not produced by the current ${COLIN_2019.shortName} model. Model manifest ${MODEL_MANIFEST_VERSION}.`,
    );
  }
  return escapeHtml(
    `${COLIN_2019.displayName}. ${COLIN_2019.citation} DOI: ${COLIN_2019.doi}. Model manifest ${MODEL_MANIFEST_VERSION}.`,
  );
}

function formatDate(): string {
  return new Date().toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

/** "Dose already given" vs. "proposed regimen": the same facts as the clinical note, as a table. */
function exposureSummarySection(s: ExposureSummary): string {
  // One text node per cell so the sentence can be localized as a whole (reportMarkup.ts).
  const figures = (f: { auc24: number; peak: number; trough: number }) =>
    `AUC\u2082\u2084 ${fmt(f.auc24, 1)} mg\u00b7h/L; peak ${fmt(f.peak, 2)} mg/L; trough ${fmt(f.trough, 2)} mg/L`;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const given = `<tr><th>${escapeHtml(s.given.title)}</th><td>${escapeHtml(s.given.regimen)}<span class="period">${escapeHtml(cap(s.given.period))}</span>${s.given.atLastDose ? `<span class="period">${escapeHtml(s.given.atLastDose)}</span>` : ""}</td><td>${figures(s.given.figures)}</td></tr>`;
  const p = s.proposed;
  const proposed = p
    ? `<tr><th>${escapeHtml(p.title)}</th><td>${escapeHtml(p.regimen)}<span class="period">${escapeHtml(cap(p.period))}</span><span class="period">${p.origin === "selected" ? escapeHtml(`Candidate selected by the clinician${p.engineRecommendation ? `; the engine recommendation is ${p.engineRecommendation}` : ""}.`) : "Engine recommendation."}</span>${p.changeNote ? `<span class="period">${escapeHtml(p.changeNote)}</span>` : ""}</td><td>${p.figures ? figures(p.figures) : "Not available"}</td></tr>`
    : `<tr><th>Proposed maintenance regimen</th><td colspan="2">None.${s.noneReason ? ` ${escapeHtml(s.noneReason)}` : ""}</td></tr>`;
  return `
  <div class="section">
    <div class="section-title">${s.given.notGiven ? "Suggested dose (not given) vs. proposed regimen" : "Dose already given vs. proposed regimen"}</div>
    <table class="exposure-table"><tbody>${given}${proposed}</tbody></table>
  </div>`;
}

/** Every warning and advisory shown with the result on screen, under its on-screen title. */
function warningsSection(warnings: NonNullable<ReportData["warnings"]>): string {
  return `
  <div class="section">
    <div class="section-title">Warnings and advisories</div>
    ${warnings.map((w) => `<div class="caution-box warning-item"><strong>${escapeHtml(w.title)}</strong><span class="warning-text">${escapeHtml(w.text)}</span></div>`).join("")}
  </div>`;
}

/**
 * The regimen box prints a dose and an interval only when both are real. A
 * withheld or absent recommendation has neither (an empty dose and interval
 * 0); it must read as "no regimen", never as " mg every 0 h".
 */
function hasPrintableRegimen(data: ReportData): boolean {
  return /\d/.test(data.recommended_dose ?? "") && Number.isFinite(data.recommended_interval_hours) && data.recommended_interval_hours > 0;
}

export function generateReportHTML(data: ReportData, tier: string = "free", locale: Locale = "en"): string {
  const now = formatDate();
  // A suggested dose that was not given, and a result with no measured level,
  // are prior-based: the subtitle must not present either as a Bayesian
  // evaluation of an existing regimen.
  const suggestedDose = data.single_dose?.kind === "suggested";
  const noMeasuredLevel = data.mode === "existing_regimen" && data.entered_levels !== undefined && data.entered_levels.length === 0;
  const modeLabel = data.mode === "initial_regimen"
    ? "Initial Regimen (Prior-Based)"
    : suggestedDose
      ? "Suggested Dose Simulation (Prior-Based, Dose Not Given)"
      : noMeasuredLevel
        ? "Existing Regimen (Prior-Based, No Measured Level)"
        : "Existing Regimen (Bayesian)";
  const posteriorLabel = data.pk_parameters?.used_posterior_refinement ? "Posterior-updated" : "Patient characteristics only";
  const watermark = buildExportWatermark(tier);

  const freqRows = (data.recommendation_blocked ? [] : data.frequency_options ?? []).map(o =>
    `<tr>
      <td>${o.dose_mg} mg</td>
      <td>q${o.interval_hours}h</td>
      <td>${fmt(o.auc24, 1)}</td>
      <td>${fmt(o.peak, 2)}</td>
      <td>${fmt(o.trough, 2)}</td>
      <td>${o.auc24 >= 400 && o.auc24 <= 600 ? "In range" : o.auc24 > 600 ? "Above" : "Below"}</td>
    </tr>`
  ).join("");

  const regimenPrintable = hasPrintableRegimen(data);
  // A candidate is shown (not the history as entered). It is headed "continue
  // as entered" only when the summary that fills the comparison table
  // (clinicalNote.ts, by regimenIdentity.ts) classifies its proposal as the
  // regimen entered with the same dose, interval and infusion duration, AND
  // the regimen printed in the box is that proposal. Any other candidate, and
  // any case without that classification, keeps "not yet given". Never under a
  // hold or a blocked recommendation: nothing is proposed there.
  const boxRegimenText = regimenPrintable
    ? `${data.recommended_dose.replace(/\s*mg$/i, "")} mg every ${data.recommended_interval_hours} h${data.recommended_infusion_duration_hours ? ` infused over ${Number((data.recommended_infusion_duration_hours * 60).toFixed(6))} minutes` : ""}`
    : null;
  const summaryProposal = data.exposure_summary?.proposed ?? null;
  const proposedContinuesEntered =
    !data.regimen_is_current && !data.recommendation_blocked && !data.review_hold &&
    summaryProposal?.change === "none" && summaryProposal.regimen === boxRegimenText;
  // The continue heading is the table row's own title, so the two are one string.
  const proposedBoxTitle = proposedContinuesEntered && summaryProposal ? escapeHtml(summaryProposal.title) : "Proposed regimen (not yet given)";
  const proposedExposureTitle = proposedContinuesEntered
    ? "Projected steady-state exposure if the regimen is continued as entered"
    : "Projected steady-state exposure of the proposed regimen (not yet given)";
  const assumptionsList = (data.assumptions ?? []).map(a => `<li>${escapeHtml(a)}</li>`).join("");
  const limitationsList = (data.limitations ?? []).map(l => `<li>${escapeHtml(l)}</li>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vancomyzer PK Report — ${now}</title>
  <style>
    @page {
      size: letter;
      margin: 0.75in;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #1a202c;
      line-height: 1.5;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e4d8c;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 700;
      color: #1e4d8c;
      letter-spacing: 2px;
    }
    .header .subtitle {
      font-size: 10px;
      color: #4a5568;
      margin-top: 2px;
    }
    .header .meta {
      text-align: right;
      font-size: 9px;
      color: #718096;
    }
    .section {
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #1e4d8c;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #cbd5e0;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    .exposure-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .exposure-table th, .exposure-table td { text-align: left; vertical-align: top; padding: 5px 6px; border: 1px solid #cbd5e0; }
    .exposure-table th { width: 32%; background: #f0f5fb; color: #1e4d8c; font-weight: 700; }
    .exposure-table .period { display: block; margin-top: 2px; color: #4a5568; font-size: 9.5px; }
    .caution-box { border: 1px solid #f6ad55; background: #fffaf0; color: #7b341e; padding: 8px 10px; font-size: 10.5px; line-height: 1.5; }
    .warning-item { margin-bottom: 4px; }
    .warning-item strong { display: block; }
    .warning-item .warning-text { display: block; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 24px;
    }
    .field {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      border-bottom: 1px dotted #e2e8f0;
    }
    .field-label { color: #4a5568; }
    .field-value { font-weight: 600; font-family: 'Courier New', monospace; color: #1a202c; }
    .metrics-row {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    .metric-card {
      flex: 1;
      border: 1px solid #cbd5e0;
      padding: 8px 12px;
      text-align: center;
    }
    .metric-label { font-size: 9px; color: #4a5568; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-value { font-size: 20px; font-weight: 700; color: #1e4d8c; font-family: 'Courier New', monospace; }
    .metric-unit { font-size: 9px; color: #718096; }
    .dose-box {
      border: 2px solid #1e4d8c;
      padding: 12px 16px;
      margin-bottom: 12px;
      background: #f7fafc;
    }
    .dose-primary { font-size: 22px; font-weight: 700; color: #1e4d8c; font-family: 'Courier New', monospace; }
    .dose-detail { font-size: 10px; color: #4a5568; margin-top: 4px; }
    .range-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 9px;
      font-weight: 700;
      border: 1px solid #6ee7b7;
      background: #ecfdf5;
      color: #047857;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f7fafc; border: 1px solid #cbd5e0; padding: 4px 8px; text-align: left; font-weight: 600; color: #1e4d8c; }
    td { border: 1px solid #e2e8f0; padding: 4px 8px; font-family: 'Courier New', monospace; }
    .interpretation { background: #f7fafc; border-left: 3px solid #1e4d8c; padding: 8px 12px; font-size: 10px; color: #2d3748; line-height: 1.6; }
    .clinical-note { background: #fffbeb; border-left: 3px solid #d97706; padding: 8px 12px; font-size: 10px; color: #2d3748; font-family: 'Courier New', monospace; line-height: 1.6; white-space: pre-wrap; }
    ul { padding-left: 16px; }
    li { margin-bottom: 3px; font-size: 10px; color: #4a5568; }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e0;
      font-size: 8px;
      color: #a0aec0;
      display: flex;
      justify-content: space-between;
    }
    .disclaimer {
      margin-top: 12px;
      padding: 6px 10px;
      border: 1px solid #fca5a5;
      background: #fff5f5;
      font-size: 8px;
      color: #991b1b;
      line-height: 1.4;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section, .disclaimer { break-inside: avoid; }
      .section-title { break-after: avoid; }
      .section { margin-bottom: 8px; }
      .clinical-note, .interpretation { line-height: 1.4; }
      .report-closing { break-inside: avoid; }
      .footer { margin-top: 8px; }
    }
    ${watermark.styleCss}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>VANCOMYZER\u2122</h1>
      <div class="subtitle">Vancomycin PK Report — ${modeLabel}</div>
    </div>
    <div class="meta">
      <div>${now}</div>
      ${data.pharmacist_name ? `<div>Pharmacist: <span data-localization="preserve">${escapeHtml(data.pharmacist_name)}</span></div>` : ""}
      ${data.institution ? `<div><span data-localization="preserve">${escapeHtml(data.institution)}</span></div>` : ""}
      <div>${escapeHtml(modelDisplayName(data.pk_model_name))}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Patient Parameters</div>
    <div class="grid-2">
      <div class="field"><span class="field-label">Age</span><span class="field-value">${data.age} years</span></div>
      <div class="field"><span class="field-label">Weight</span><span class="field-value">${data.weight_kg} kg</span></div>
      <div class="field"><span class="field-label">Serum Creatinine</span><span class="field-value">${data.serum_creatinine_mg_dl} mg/dL</span></div>
      <div class="field"><span class="field-label">Estimation</span><span class="field-value">${posteriorLabel}</span></div>
    </div>
  </div>

  ${data.dosing_history ? `
  <div class="section">
    <div class="section-title">Dosing history entered</div>
    <div class="interpretation">${escapeHtml(data.dosing_history)}</div>
    ${data.entered_levels && data.entered_levels.length > 0 ? `<div class="interpretation" style="margin-top:4px">${data.entered_levels.map((l, i) => `Level ${i + 1}: ${fmt(l.value_mg_l, 1)} mg/L at ${fmt(l.hours_after_last_dose, 2)} h after the start of the last dose`).join("<br/>")}</div>` : ""}
  </div>` : ""}

  ${data.exposure_summary ? exposureSummarySection(data.exposure_summary) : ""}

  ${data.warnings && data.warnings.length > 0 ? warningsSection(data.warnings) : ""}

  ${data.one_level_caution ? `
  <div class="section">
    <div class="section-title">One measured level: provisional estimate</div>
    <div class="caution-box">${escapeHtml(data.one_level_caution)}</div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">${data.regimen_is_current ? (data.single_dose ? (data.single_dose.kind === "loading" ? "Loading dose given (single dose)" : suggestedDose ? "Suggested loading dose (not given)" : "Single dose given") : "Current regimen (as entered)") : data.exposure_summary ? proposedBoxTitle : "Recommended Regimen"}</div>
    <div class="dose-box">
      ${data.recommendation_blocked ? `<span class="dose-primary">No automatic maintenance regimen</span><div class="dose-detail">${escapeHtml(data.recommendation_blocked)}</div>` : data.regimen_is_current && data.single_dose ? `<span class="dose-primary">${data.single_dose.dose_mg} mg \u00d7 1</span><div class="dose-detail">${suggestedDose ? "A suggested dose that has not been given, not a regimen. Projected exposure is that dose over its first 24 h if it is given, not steady state." : "One dose, not a regimen. Exposure is that dose over its first 24 h, not steady state."}</div>` : regimenPrintable ? `<span class="dose-primary">${escapeHtml(data.recommended_dose.replace(/\s*mg$/i, ""))} mg every ${data.recommended_interval_hours} h</span>` : `<span class="dose-primary">No regimen is presented</span>`}
      ${!data.recommendation_blocked && (regimenPrintable || (data.regimen_is_current && data.single_dose)) && data.recommended_infusion_duration_hours ? `<div class="dose-detail">${data.regimen_is_current && suggestedDose ? `Suggested infusion over ${Number((data.recommended_infusion_duration_hours * 60).toFixed(6))} minutes (not given)` : `${data.regimen_is_current ? "Infused over" : "Infuse over"} ${Number((data.recommended_infusion_duration_hours * 60).toFixed(6))} minutes${data.regimen_is_current || proposedContinuesEntered ? " (as entered)" : ""}`}</div>` : ""}
      ${data.review_hold ? `<div class="dose-detail"><strong>Recommendation withheld.</strong> No dose adjustment is presented until the entered levels are reconciled; see Warnings and advisories.</div>` : ""}
      ${!data.recommendation_blocked && (regimenPrintable || (data.regimen_is_current && data.single_dose)) ? `<div class="dose-detail" style="margin-top:6px">
        AUC\u2082\u2084: <strong>${fmt(data.auc24, 1)} mg\u00b7h/L</strong>
        ${data.auc24 >= 400 && data.auc24 <= 600 && !(data.regimen_is_current && data.single_dose) ? '<span class="range-badge">IN RANGE</span>' : ""}
      </div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">${data.recommendation_blocked ? (data.mode === "initial_regimen" ? "No maintenance exposure predicted" : data.single_dose ? (suggestedDose ? "Projected exposure of the suggested dose, not given (first 24 h; no automatic recommendation)" : "Exposure of the dose already given (first 24 h; no automatic recommendation)") : "Current regimen exposure (no automatic recommendation)") : data.exposure_summary ? (data.regimen_is_current ? (data.single_dose ? (suggestedDose ? "Projected exposure of the suggested dose, not given (first 24 h, not steady state)" : "Exposure of the dose already given (first 24 h, not steady state)") : "Steady-state projection of the current regimen (as entered)") : proposedExposureTitle) : "Predicted Pharmacokinetic Metrics"}</div>
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-label">AUC\u2082\u2084</div>
        <div class="metric-value">${data.recommendation_blocked && data.mode === "initial_regimen" ? "Not available" : fmt(data.auc24, 1)}</div>
        <div class="metric-unit">mg\u00b7h/L</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Peak</div>
        <div class="metric-value">${data.recommendation_blocked && data.mode === "initial_regimen" ? "Not available" : fmt(data.peak, 2)}</div>
        <div class="metric-unit">mg/L</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Trough</div>
        <div class="metric-value">${data.recommendation_blocked && data.mode === "initial_regimen" ? "Not available" : fmt(data.trough, 2)}</div>
        <div class="metric-unit">mg/L</div>
      </div>
    </div>
  </div>

  ${data.pk_parameters ? `
  <div class="section">
    <div class="section-title">PK Parameters (${escapeHtml(modelShortName(data.pk_model_name))})</div>
    <div class="grid-2">
      <div class="field"><span class="field-label">CL (Clearance)</span><span class="field-value">${fmt(data.pk_parameters.CL, 2)} L/h</span></div>
      <div class="field"><span class="field-label">V1 (Central Volume)</span><span class="field-value">${fmt(data.pk_parameters.V1, 1)} L</span></div>
      <div class="field"><span class="field-label">Q (Intercompartmental CL)</span><span class="field-value">${fmt(data.pk_parameters.Q, 2)} L/h</span></div>
      <div class="field"><span class="field-label">V2 (Peripheral Volume)</span><span class="field-value">${fmt(data.pk_parameters.V2, 1)} L</span></div>
    </div>
  </div>
  ` : ""}

  ${freqRows ? `
  <div class="section">
    <div class="section-title">Dose Options (AUC\u2082\u2084 400\u2013600 mg\u00b7h/L)</div>
    <table>
      <thead><tr><th>Dose</th><th>Interval</th><th>AUC\u2082\u2084</th><th>Peak</th><th>Trough</th><th>Status</th></tr></thead>
      <tbody>${freqRows}</tbody>
    </table>
  </div>
  ` : ""}

  ${data.interpretation_summary ? `
  <div class="section">
    <div class="section-title">Clinical Interpretation</div>
    <div class="interpretation">${escapeHtml(data.interpretation_summary)}</div>
  </div>
  ` : ""}

  ${data.clinical_note ? `
  <div class="section">
    <div class="section-title">Clinical Note (for Medical Record)</div>
    <div class="clinical-note">${escapeHtml(data.clinical_note)}</div>
  </div>
  ` : ""}

  ${assumptionsList ? `
  <div class="section">
    <div class="section-title">Assumptions</div>
    <ul>${assumptionsList}</ul>
  </div>
  ` : ""}

  ${limitationsList ? `
  <div class="section">
    <div class="section-title">Limitations</div>
    <ul>${limitationsList}</ul>
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Model</div>
    <div class="interpretation">${modelMethodsHtml(data.pk_model_name)}</div>
  </div>

  <div class="report-closing">
  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is generated by Vancomyzer\u2122, a clinical decision-support tool. It is not a substitute for professional medical judgment. All recommendations must be independently verified by a licensed clinician. ${escapeHtml(REGULATORY_SHORT)} ${escapeHtml(VALIDATION_STATUS)}
  </div>

  <div class="footer">
    <span>\u00a9 ${new Date().getFullYear()} Vancomyzer\u2122 \u00b7 Engineered by <a href="https://dosys.health" style="color:inherit;text-decoration:underline">D\u014Dsys\u2122</a></span>
    <span>Generated: ${now} \u00b7 Model manifest ${MODEL_MANIFEST_VERSION}</span>
  </div>

  </div>

  ${watermark.overlayHtml}
  ${watermark.bannerHtml}
</body>
</html>`;
  return localizeReportMarkup(html, locale);
}

/**
 * Open a print dialog with the report HTML.
 * The pharmacist can then save as PDF or print to paper.
 */
export function printReport(data: ReportData, tier: string = "free", locale: Locale = "en") {
  const html = generateReportHTML(data, tier, locale);
  const win = window.open("", "_blank", "width=800,height=1100");
  if (!win) {
    alert(translate("Please allow popups to generate the PDF report.", locale));
    return;
  }
  win.document.write(html);
  win.document.close();
  // Wait for rendering before triggering print
  setTimeout(() => {
    win.print();
  }, 500);
}
