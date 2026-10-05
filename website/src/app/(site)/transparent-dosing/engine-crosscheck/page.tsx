import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";

import { LocalizedText } from "@/localization/LanguageProvider";
/** Current Tucuxi comparison; historical results remain in the analysis records. */

import Link from "next/link";
import { PARAM_LABEL } from "@/lib/validation/engineCrosscheck";
import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import {
  AGREEMENT_2026,
  CRITERIA_2026,
  ACCURACY_VS_TRUTH_2026,
  EXPOSURE_AGREEMENT_2026,
  PRIOR_VALIDATION_2026,
  ATTRIBUTION_2026,
  CROSSCHECK_META_2026,
  PARAM_ORDER_2026,
  RERUN_2026,
} from "@/lib/validation/engineCrosscheck2026";

/** Signed percentage without a negative zero. */
function signedPct(x: number, d = 2): string {
  const v = Number(x.toFixed(d));
  return `${v > 0 ? "+" : ""}${(Object.is(v, -0) ? 0 : v).toFixed(d)}%`;
}
/** Relative difference in plain words rather than scientific notation. */
function relDiff(x: number): string {
  if (x === 0) return "exact";
  if (x < 1e-6) return "< 1 in a million";
  return `${(100 * x).toFixed(4)}%`;
}

const englishMetadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing/engine-crosscheck" },
  title: "Comparison with Tucuxi — Vancomyzer",
  description:
    "Vancomyzer and Tucuxi compared in 200 simulated patients, with results, methods and limitations. This comparison does not establish clinical accuracy.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export default function EngineCrosscheckPage() {
  const a = AGREEMENT_2026;
  const m = CROSSCHECK_META_2026;
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 16px 80px", color: "#14232f" }}>
      <Breadcrumb />

      <h1 className="vz-serif" style={{ fontSize: "clamp(28px, 3.4vw, 40px)", color: "#14232f", marginBottom: 12, lineHeight: 1.1 }}><LocalizedText text="Comparison with Tucuxi" /></h1>
      <p style={{ fontSize: 17, color: "#4a5a68", lineHeight: 1.55, marginTop: 0, marginBottom: 12, maxWidth: "62ch" }}><LocalizedText text="The Vancomyzer team compared its calculator with" />{" "}<strong>Tucuxi</strong><LocalizedText text=", a dosing program developed by the REDS institute at HEIG-VD, Switzerland. On" />{" "}<LocalizedText text={m.displayDate} /><LocalizedText text=", both programs received the same starting estimates based on Colin’s population equations, similar dosing histories at steady state, and the same two blood levels for" />{" "}{m.n}{" "}<LocalizedText text="simulated patients. The median absolute difference in clearance estimates was" />{" "}{a.CL.median_abs_pct.toFixed(2)}<LocalizedText text="%. The 95th percentile was" />{" "}{a.CL.p95_abs_pct.toFixed(2)}<LocalizedText text="%, and the largest difference was" />{" "}{a.CL.max_abs_pct.toFixed(2)}<LocalizedText text="%. Both programs completed all calculations." /></p>
      <p style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 760 }}><LocalizedText text="Vancomyzer has not yet been validated in real patients. Its equations are checked against published values and synthetic test cases; external validation with patient data is planned." /></p>

      <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        <strong><LocalizedText text="How to interpret this comparison." /></strong>{" "}<LocalizedText text="The numerical limits set before the comparison were met. However, the programs handled uncertainty in blood levels differently, so their calculations were not identical. This comparison does not reproduce the full Colin Bayesian model. Tucuxi used 60 repeated doses to approximate steady state. At the sampling times, this differed from the long-term steady-state calculation by no more than 0.014%, using Tucuxi’s saved estimates. A difference in how clearance is calculated from the article and its supplement remains unresolved; neither interpretation has been confirmed by the model author." /></p>
      <RunNotice />
      <PriorGateCard />
      <ResultCard2026 />
      <AccuracyCard2026 />
      <AttributionCard />
      <MethodologyCard2026 />
      <ScopeCard2026 />

    </div>
  );
}

function RunNotice() {
  const m = CROSSCHECK_META_2026;
  return (
    <div style={{
      padding: "14px 18px",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
      borderLeft: "3px solid #059669",
      color: "#064e3b",
      borderRadius: 4,
      fontSize: 13,
      lineHeight: 1.55,
      marginBottom: 24,
    }}>
      <strong><LocalizedText text="Comparison dated" />{" "}<LocalizedText text={m.displayDate} /><LocalizedText text=", calculator version" />{" "}{m.engineManifest}.</strong>{" "}<LocalizedText text="The test data, model settings, results and instructions are available for" /><a href={`https://github.com/marioce75/vancomyzer_website/blob/main/website/${m.recordPath}`} style={{ textDecoration: "underline" }}>{" "}<LocalizedText text="independent review" /></a>.{" "}
      {RERUN_2026.allFitsSucceeded && RERUN_2026.maxRelDiffPct === 0
        ? <><LocalizedText text="Repeating the Vancomyzer calculations with version" />{" "}{RERUN_2026.version}<LocalizedText text="gave the same estimates for these patients. This check covered two blood levels at steady state; it did not cover every calculator workflow." /></>
        : <><LocalizedText text="Repeating the Vancomyzer calculations with version" />{" "}{RERUN_2026.version}<LocalizedText text="changed the estimates by at most" />{" "}{RERUN_2026.maxRelDiffPct.toFixed(3)}%.</>}
    </div>
  );
}

function PriorGateCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}><LocalizedText text="Check before using blood levels" /></h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}><LocalizedText text="The Vancomyzer team supplied Tucuxi with the equations and starting assumptions used in this comparison. These were based on Colin’s population equations, with separate assumptions about variability. They were not the complete published Bayesian model or a model approved by its author. Before adding blood levels, Tucuxi had to match independently calculated values for a reference patient (35 years, 70 kg, serum creatinine 0.83 mg/dL; 1000 mg every 12 hours infused over 1.75 hours). A mismatch would have stopped the comparison." /></p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}><LocalizedText text="Quantity" /></th>
              <th style={numCellStyle}>Tucuxi</th>
              <th style={numCellStyle}><LocalizedText text="Reference" /></th>
              <th style={numCellStyle}><LocalizedText text="Relative difference" /></th>
              <th style={cellStyle}><LocalizedText text="Result" /></th>
            </tr>
          </thead>
          <tbody>
            {PRIOR_VALIDATION_2026.map((r, i) => (
              <tr key={r.check.replace("mg*h/L", "mg·h/L")} style={{ borderBottom: i < PRIOR_VALIDATION_2026.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{r.check.replace("mg*h/L", "mg·h/L")}</td>
                <td style={numCellStyle}>{r.tucuxi.toFixed(4)}</td>
                <td style={numCellStyle}>{r.reference.toFixed(4)}</td>
                <td style={numCellStyle}>{relDiff(Math.abs(r.tucuxi - r.reference) / r.reference)}</td>
                <td style={{ ...cellStyle, color: r.ok ? "#047857" : "#b91c1c", fontWeight: 700 }}><LocalizedText text={r.ok ? "pass" : "FAIL"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}><LocalizedText text="The independent reference calculations are described on the Literature Reproducibility page. This check included the starting estimates before blood levels were added." /></p>
    </section>
  );
}

function ResultCard2026() {
  const s = AGREEMENT_2026;
  const c = CRITERIA_2026;
  const e = EXPOSURE_AGREEMENT_2026;
  const criteria = [
    { label: "Clearance Median absolute difference ≤ 2%", value: `${s.CL.median_abs_pct.toFixed(2)}%`, met: c.CL_median_abs_pct_le_2 },
    { label: "Clearance 95th percentile |Δ| ≤ 10%", value: `${s.CL.p95_abs_pct.toFixed(2)}%`, met: c.CL_p95_abs_pct_le_10 },
    { label: "Central volume Median absolute difference ≤ 3%", value: `${s.V1.median_abs_pct.toFixed(2)}%`, met: c.V1_median_abs_pct_le_3 },
    { label: "Failed or excluded calculations ≤ 2% of patients", value: `${c.excluded} of ${CROSSCHECK_META_2026.n}`, met: c.excluded_le_2pct },
    { label: `Every clearance difference > 10% explained`, value: `${c.outliers_over_10pct} such cases`, met: c.outliers_over_10pct === 0 },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}><LocalizedText text="Agreement between the two programs · n =" />{" "}{CROSSCHECK_META_2026.n}</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}><LocalizedText text="Difference between the two programs’ individual (posterior) estimates, Vancomyzer relative to Tucuxi, per parameter. Q and V₂ are reported without a criterion: two levels barely inform them, so both programs stay near the shared prior." /></p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}><LocalizedText text="Parameter" /></th>
              <th style={numCellStyle}><LocalizedText text="Median absolute difference" /></th>
              <th style={numCellStyle}><LocalizedText text="Mean signed difference" /></th>
              <th style={numCellStyle}><LocalizedText text="90th percentile" /></th>
              <th style={numCellStyle}><LocalizedText text="95th percentile" /></th>
              <th style={numCellStyle}><LocalizedText text="Largest difference" /></th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER_2026.map((k, i) => {
              const row = s[k];
              return (
                <tr key={k} style={{ borderBottom: i < PARAM_ORDER_2026.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                  <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}><LocalizedText text={PARAM_LABEL[k]} /></td>
                  <td style={numCellStyle}>{row.median_abs_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{signedPct(row.mean_signed_pct)}</td>
                  <td style={numCellStyle}>{row.p90_abs_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.p95_abs_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.max_abs_pct.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "14px 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-dim)" }}><LocalizedText text="Acceptance criteria (fixed 17 Sep 2026, before the run)" /></p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
        {criteria.map((r) => (
          <li key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "5px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 3 }}>
            <span style={{ color: "var(--color-secondary)" }}><LocalizedText text={r.label} /></span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}>
              <LocalizedText text={r.value} /> <strong style={{ color: r.met ? "#047857" : "#b91c1c" }}><LocalizedText text={r.met ? "met" : "not met"} /></strong>
            </span>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}><LocalizedText text="Steady-state exposure computed from each program’s own estimates: AUC₂₄ Median absolute difference" />{" "}
        {e.auc24.median_abs_pct.toFixed(2)}<LocalizedText text="% (95th percentile" />{" "}{e.auc24.p95_abs_pct.toFixed(2)}<LocalizedText text="%, maximum" />{" "}
        {e.auc24.max_abs_pct.toFixed(2)}<LocalizedText text="%), peak" />{" "}{e.peak.median_abs_pct.toFixed(2)}<LocalizedText text="%, trough" />{" "}
        {e.trough.median_abs_pct.toFixed(2)}<LocalizedText text="% (maximum" />{" "}{e.trough.max_abs_pct.toFixed(2)}<LocalizedText text="%; the trough is the quantity most sensitive to clearance). Meeting these criteria means the two programs agree on this synthetic cohort; it does not mean the programs are interchangeable in practice." /></p>
    </section>
  );
}

function AccuracyCard2026() {
  const a = ACCURACY_VS_TRUTH_2026;
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}><LocalizedText text="Accuracy in simulated patients" /></h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}><LocalizedText text="Because the patients are simulated, their “true” parameters are known. Median absolute percentage error of each program’s estimates against that truth, with the unfitted prior for reference (lower is better)." /></p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}><LocalizedText text="Parameter" /></th>
              <th style={numCellStyle}><LocalizedText text="Before blood levels" /></th>
              <th style={numCellStyle}><LocalizedText text="Vancomyzer" /></th>
              <th style={numCellStyle}>Tucuxi</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER_2026.map((k, i) => (
              <tr key={k} style={{ borderBottom: i < PARAM_ORDER_2026.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}><LocalizedText text={PARAM_LABEL[k]} /></td>
                <td style={{ ...numCellStyle, color: "var(--color-dim)" }}>{a[k].prior.toFixed(1)}%</td>
                <td style={numCellStyle}>{a[k].vz.toFixed(1)}%</td>
                <td style={numCellStyle}>{a[k].tucuxi.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}><LocalizedText text="In this comparison, only" />{" "}<strong><LocalizedText text="clearance" /></strong>{" "}<LocalizedText text="improves materially with a two-level fit (" />{a.CL.prior.toFixed(1)}<LocalizedText text="% with the prior alone," />{" "}{a.CL.vz.toFixed(1)}<LocalizedText text="% for Vancomyzer," />{" "}
        {a.CL.tucuxi.toFixed(1)}<LocalizedText text="% for Tucuxi). The simulated patient values come from a simulation adapted by the Vancomyzer team from Goti’s work, rather than the complete published Goti model, so the results describe performance in a simulation, not accuracy in patients." /></p>
    </section>
  );
}

function AttributionCard() {
  const rows = ATTRIBUTION_2026.cases;
  const worst = rows[0];
  const maxRefitErr = Math.max(...rows.flatMap((r) => [Math.abs(r.refit_vform_vs_vancomyzer_pct), Math.abs(r.refit_tform_vs_tucuxi_pct)]));
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}><LocalizedText text="Largest disagreements — and why" /></h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}><LocalizedText text="The programs give different weight to blood levels that are higher than predicted. Vancomyzer allows more uncertainty around those levels, which can change the clearance estimate. To investigate, the team repeated the calculations for all" />{" "}{rows.length}{" "}<LocalizedText text="simulated patients with a clearance difference of" />{" "}{ATTRIBUTION_2026.threshold_pct}<LocalizedText text="% or more. A separately written calculation used each program’s approach to blood-level uncertainty in turn." /></p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}><LocalizedText text="Patient" /></th>
              <th style={numCellStyle}><LocalizedText text="Vancomyzer CL" /></th>
              <th style={numCellStyle}><LocalizedText text="Tucuxi CL" /></th>
              <th style={numCellStyle}><LocalizedText text="Difference" /></th>
              <th style={numCellStyle}><LocalizedText text="Repeat calculation vs Vancomyzer" /></th>
              <th style={numCellStyle}><LocalizedText text="Repeat calculation vs Tucuxi" /></th>
              <th style={numCellStyle}><LocalizedText text="Effect of uncertainty assumptions" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)" }}>{r.id}</td>
                <td style={numCellStyle}>{r.vancomyzer_CL.toFixed(3)}</td>
                <td style={numCellStyle}>{r.tucuxi_CL.toFixed(3)}</td>
                <td style={{ ...numCellStyle, fontWeight: 600, color: "var(--color-primary)" }}>{signedPct(r.dCL_pct_vanco_vs_tucuxi)}</td>
                <td style={numCellStyle}>{signedPct(r.refit_vform_vs_vancomyzer_pct)}</td>
                <td style={numCellStyle}>{signedPct(r.refit_tform_vs_tucuxi_pct)}</td>
                <td style={numCellStyle}>{signedPct(r.form_effect_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}><LocalizedText text="The separate calculation matched each program’s clearance estimate to within" />{" "}{maxRefitErr.toFixed(2)}<LocalizedText text="% when it used that program’s uncertainty assumptions. This supports those assumptions as the explanation for the differences in these" />{" "}{rows.length}{" "}<LocalizedText text="cases. The largest difference was" />{worst.dCL_pct_vanco_vs_tucuxi.toFixed(2)}<LocalizedText text="% in case" />{" "}{worst.id}<LocalizedText text=". This finding applies to the selected clearance estimates. It does not establish which approach is more accurate in real patients." /></p>
    </section>
  );
}

function MethodologyCard2026() {
  const m = CROSSCHECK_META_2026;
  const sd = m.priorLogSd;
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}><LocalizedText text="Method" /></h2>
      <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: "var(--color-secondary)" }}>
        <li><LocalizedText text="Create" />{" "}{m.n}{" "}<LocalizedText text="simulated ICU patients using a model adapted from Goti’s work, then simulate two blood levels with measurement error. The data and full settings are available in the linked methods." /></li>
        <li><LocalizedText text="Run Vancomyzer’s calculator (calculator version" />{" "}{m.engineManifest}<LocalizedText text=") on each patient:" />{" "}{COLIN_2019.shortName}{" "}<LocalizedText text="starting estimates from patient characteristics, then update them using the two blood levels." /></li>
        <li><LocalizedText text="Use the Colin 2019 equations in Tucuxi with prior variability (log-scale SD: CL" />{" "}{sd.CL}, V₁ {sd.V1}, Q {sd.Q}, V₂ {sd.V2}<LocalizedText text=") and Tucuxi’s mixed residual error (1.0 mg/L additive, 15% proportional). Check its prior-only prediction against the reference patient (table above). Then give Tucuxi a 60-dose history approximating steady state and the same two levels per patient and run its Bayesian fit." /></li>
        <li><LocalizedText text="Compare the estimates against limits set on 17 Sep 2026, before the analysis. Repeat calculations for clearance differences of 3% or more using each program’s uncertainty assumptions." /></li>
      </ol>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}><LocalizedText text="Comparator:" />{" "}{m.comparator}<LocalizedText text=". The exact program version, test data, model definitions and analysis scripts are available in the" />{" "}<a href="https://github.com/marioce75/vancomyzer_website/tree/main/website/src/lib/validation/crosscheck" style={{ textDecoration: "underline" }}><LocalizedText text="reproducibility materials" /></a>.
      </p>
    </section>
  );
}

function ScopeCard2026() {
  const limits = [
    {
      label: "What was compared",
      body: "Both programs used starting estimates and variability assumptions supplied by Vancomyzer, based on Colin’s population equations. Their similar results apply to these simulated patients and shared assumptions. They do not confirm the full published Colin model or establish accuracy in patients.",
    },
    {
      label: "Blood-level uncertainty",
      body: "The programs handle blood-level uncertainty differently. Repeating the calculations supported this as the explanation for the 14 clearance differences of 3% or more. Differences reached about 9% in simulated patients with levels well above prediction.",
    },
    {
      label: "Simulated patients only",
      body: "The patients and their levels are computer-generated. Real-patient performance has not been evaluated; the Predictive Performance analysis is also synthetic.",
    },
    {
      label: "Two-level sampling",
      body: "A post-infusion level and a trough at steady state mainly inform clearance. Agreement on Q and V₂ largely reflects both programs staying near the shared prior.",
    },
    {
      label: "Open-source comparator only",
      body: "Commercial Bayesian dosing products were not run; no results for them are shown or implied.",
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}><LocalizedText text="Scope & limitations" /></h2>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
        {limits.map((l) => (
          <li key={l.label} style={{ padding: "10px 12px", borderLeft: "3px solid #d97706", background: "#fffbeb", marginBottom: 8, borderRadius: 3 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}><LocalizedText text={l.label} /></p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f", lineHeight: 1.55 }}><LocalizedText text={l.body} /></p>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}><LocalizedText text="The results met the numerical limits set for this group of" />{" "}{CROSSCHECK_META_2026.n}{" "}<LocalizedText text="simulated patients. The separate check of the largest clearance differences supported blood-level uncertainty assumptions as their explanation. Clinical accuracy and the choice of uncertainty assumptions still need evaluation with patient data." /></p>
    </section>
  );
}

function Breadcrumb() {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
      <Link href="/transparent-dosing" style={{ color: "var(--color-dim)", textDecoration: "none" }}><LocalizedText text="Evidence" /></Link>
      <span aria-hidden="true" style={{ color: "#546471" }}>·</span>
      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}><LocalizedText text="Comparison with Tucuxi" /></span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: "20px 22px",
  marginBottom: 20,
  background: "#ffffff",
  border: "1px solid #cbd6e0",
  borderRadius: 0,
};
const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Newsreader', Georgia, serif",
  fontSize: 22,
  fontWeight: 500,
  color: "#14232f",
  margin: 0,
  letterSpacing: "-0.01em",
  lineHeight: 1.25,
};
const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
};
const numCellStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap",
};

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}
