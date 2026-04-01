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
 */

export interface ReportData {
  // Patient
  age: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;

  // Regimen
  mode: "initial_regimen" | "existing_regimen";
  recommended_dose: string;
  recommended_interval_hours: number;
  recommended_infusion_duration_hours?: number;

  // PK Metrics
  auc24: number;
  peak: number;
  trough: number;

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

function formatDate(): string {
  return new Date().toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

export function generateReportHTML(data: ReportData): string {
  const now = formatDate();
  const modeLabel = data.mode === "initial_regimen" ? "Initial Regimen (Prior-Based)" : "Existing Regimen (Bayesian)";
  const posteriorLabel = data.pk_parameters?.used_posterior_refinement ? "Posterior-updated" : "Population prior only";

  const freqRows = (data.frequency_options ?? []).map(o =>
    `<tr>
      <td>${o.dose_mg} mg</td>
      <td>q${o.interval_hours}h</td>
      <td>${o.auc24.toFixed(1)}</td>
      <td>${o.peak.toFixed(2)}</td>
      <td>${o.trough.toFixed(2)}</td>
      <td>${o.auc24 >= 400 && o.auc24 <= 600 ? "In range" : o.auc24 > 600 ? "Above" : "Below"}</td>
    </tr>`
  ).join("");

  const assumptionsList = (data.assumptions ?? []).map(a => `<li>${escapeHtml(a)}</li>`).join("");
  const limitationsList = (data.limitations ?? []).map(l => `<li>${escapeHtml(l)}</li>`).join("");

  return `<!DOCTYPE html>
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
    }
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
      ${data.pharmacist_name ? `<div>Pharmacist: ${escapeHtml(data.pharmacist_name)}</div>` : ""}
      ${data.institution ? `<div>${escapeHtml(data.institution)}</div>` : ""}
      <div>Colin 2019 Two-Compartment Model</div>
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

  <div class="section">
    <div class="section-title">Recommended Regimen</div>
    <div class="dose-box">
      <span class="dose-primary">${escapeHtml(data.recommended_dose)} mg every ${data.recommended_interval_hours} h</span>
      ${data.recommended_infusion_duration_hours ? `<div class="dose-detail">Infuse over ${data.recommended_infusion_duration_hours} hours</div>` : ""}
      <div class="dose-detail" style="margin-top:6px">
        AUC\u2082\u2084: <strong>${data.auc24.toFixed(1)} mg\u00b7h/L</strong>
        ${data.auc24 >= 400 && data.auc24 <= 600 ? '<span class="range-badge">IN RANGE</span>' : ""}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Predicted Pharmacokinetic Metrics</div>
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-label">AUC\u2082\u2084</div>
        <div class="metric-value">${data.auc24.toFixed(1)}</div>
        <div class="metric-unit">mg\u00b7h/L</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Peak</div>
        <div class="metric-value">${data.peak.toFixed(2)}</div>
        <div class="metric-unit">mcg/mL</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Trough</div>
        <div class="metric-value">${data.trough.toFixed(2)}</div>
        <div class="metric-unit">mcg/mL</div>
      </div>
    </div>
  </div>

  ${data.pk_parameters ? `
  <div class="section">
    <div class="section-title">PK Parameters (Colin 2019)</div>
    <div class="grid-2">
      <div class="field"><span class="field-label">CL (Clearance)</span><span class="field-value">${data.pk_parameters.CL.toFixed(2)} L/h</span></div>
      <div class="field"><span class="field-label">V1 (Central Volume)</span><span class="field-value">${data.pk_parameters.V1.toFixed(1)} L</span></div>
      <div class="field"><span class="field-label">Q (Intercompartmental CL)</span><span class="field-value">${data.pk_parameters.Q.toFixed(2)} L/h</span></div>
      <div class="field"><span class="field-label">V2 (Peripheral Volume)</span><span class="field-value">${data.pk_parameters.V2.toFixed(1)} L</span></div>
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

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is generated by Vancomyzer\u2122, a clinical decision-support tool. It is not a substitute for professional medical judgment. All recommendations must be independently verified by a licensed clinician. Not FDA-cleared. Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780.
  </div>

  <div class="footer">
    <span>\u00a9 ${new Date().getFullYear()} Vancomyzer\u2122 \u00b7 Engineered by D\u014Dsys\u2122</span>
    <span>Generated: ${now}</span>
  </div>
</body>
</html>`;
}

/**
 * Open a print dialog with the report HTML.
 * The pharmacist can then save as PDF or print to paper.
 */
export function printReport(data: ReportData) {
  const html = generateReportHTML(data);
  const win = window.open("", "_blank", "width=800,height=1100");
  if (!win) {
    alert("Please allow popups to generate the PDF report.");
    return;
  }
  win.document.write(html);
  win.document.close();
  // Wait for rendering before triggering print
  setTimeout(() => {
    win.print();
  }, 500);
}
