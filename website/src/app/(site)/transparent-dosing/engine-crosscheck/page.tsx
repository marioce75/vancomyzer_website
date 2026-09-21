/**
 * /transparent-dosing/engine-crosscheck — Comparison with Tucuxi (Vancomyzer vs Tucuxi).
 *
 * Two developer-run synthetic analyses (not real patients):
 *   - 18 Sep 2026: the reproducible run from src/lib/validation/crosscheck/
 *     (committed fixture, committed Tucuxi model file, pre-set acceptance
 *     criteria, every tail case attributed). Numbers come from the committed
 *     result files via engineCrosscheck2026.ts; nothing is retyped.
 *   - 30 May 2026: the earlier one-off snapshot (engine-crosscheck-report.json),
 *     kept below, labelled, because it was published and because it used the
 *     calculator before the 15 Sep 2026 model change.
 *
 * Scope (stated on the page): same prior, same data, independently
 * implemented MAP estimator — a common-math check. It does not validate the
 * Colin 2019 equations clinically or show accuracy in patients.
 */

import Link from "next/link";
import {
  CROSSCHECK,
  CROSSCHECK_META,
  PARAM_ORDER,
  PARAM_LABEL,
  auditCrosscheckCohort,
  type Outlier,
} from "@/lib/validation/engineCrosscheck";
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
} from "@/lib/validation/engineCrosscheck2026";

export const metadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing/engine-crosscheck" },
  title: "Comparison with Tucuxi — Vancomyzer",
  description:
    "A developer-run synthetic analysis (not real patients): Vancomyzer's Bayesian fitting compared with Tucuxi-core " +
    "given the same Colin 2019 prior and the same simulated levels, against pre-set acceptance criteria (n=200, run 18 Sep 2026; " +
    "earlier 30 May 2026 snapshot retained).",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function range(values: number[], digits: number): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo.toFixed(digits) === hi.toFixed(digits) ? lo.toFixed(digits) : `${lo.toFixed(digits)}–${hi.toFixed(digits)}`;
}

export default function EngineCrosscheckPage() {
  const audit = auditCrosscheckCohort();
  const a = AGREEMENT_2026;
  const m = CROSSCHECK_META_2026;
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Comparison with Tucuxi
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 12, maxWidth: 760 }}>
        A developer-run synthetic analysis (not real patients). Vancomyzer&rsquo;s Bayesian fitting was compared
        with <strong>Tucuxi</strong>, an open-source model-informed precision dosing program developed by the
        REDS institute at HEIG-VD, Switzerland. On {m.displayDate} both programs were given the same Colin 2019
        prior, the same dosing history and the same two simulated levels for {m.n} synthetic patients, and the
        result was scored against acceptance criteria written down before the run. The median absolute difference
        between their clearance estimates was {a.CL.median_abs_pct.toFixed(2)}% (95th percentile{" "}
        {a.CL.p95_abs_pct.toFixed(2)}%, maximum {a.CL.max_abs_pct.toFixed(2)}%), every fit succeeded, and every
        difference above {ATTRIBUTION_2026.threshold_pct}% was traced to one documented design difference between
        the two programs.
      </p>
      <p style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 760 }}>
        Vancomyzer has not yet been validated in real patients. Its equations are checked against published
        values and synthetic test cases; external validation with patient data is planned.
      </p>

      <RunNotice />
      <PriorGateCard />
      <ResultCard2026 />
      <AccuracyCard2026 />
      <AttributionCard />
      <MethodologyCard2026 />
      <ScopeCard2026 />

      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", margin: "40px 0 6px" }}>
        Earlier comparison — {CROSSCHECK_META.displayDate}
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.55, marginTop: 0, marginBottom: 16, maxWidth: 760 }}>
        The first comparison, run once with the calculator as it was on that date, before the 15 Sep 2026 model
        change. It is kept here because it was published; it has been superseded by the reproducible run
        above, whose analysis scripts, test data and model file are committed to the repository. The numbers below are
        unchanged from the original publication.
      </p>
      <SnapshotNotice />
      <ResultCard />
      <AccuracyCard />
      <OutlierCard audit={audit} />
      <MethodologyCard />
      <ScopeCard />
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
      <strong>Reproducible run of {m.displayDate}, calculation version {m.engineManifest}.</strong> The synthetic
      cohort (seed {m.seed}), the Tucuxi model file, the per-patient query generator, the raw result files and the
      comparison script are committed to the repository (<a href={`https://github.com/marioce75/vancomyzer_website/blob/design/direction-a/website/${m.recordPath}`} style={{ textDecoration: "underline" }}>reproducibility instructions</a>), so the run can be repeated
      by anyone with a Tucuxi build. Tucuxi itself is built from source and is not part of the site build, so the
      figures below are read from that run&rsquo;s saved result files rather than recomputed on each visit.
    </div>
  );
}

function PriorGateCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Gate: Tucuxi reproduces the reference patient before any fit</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        The Colin 2019 covariate equations were written into a Tucuxi model file, which Tucuxi evaluates itself.
        Before any posterior comparison, Tucuxi&rsquo;s <em>prior-only</em> prediction for the reference patient
        (35 y, 70 kg, SCr 0.83 mg/dL; 1000 mg q12h over 1.75 h) had to match the independent reference values;
        a mismatch would have stopped the run.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Quantity</th>
              <th style={numCellStyle}>Tucuxi</th>
              <th style={numCellStyle}>Reference</th>
              <th style={numCellStyle}>Relative difference</th>
              <th style={cellStyle}>Result</th>
            </tr>
          </thead>
          <tbody>
            {PRIOR_VALIDATION_2026.map((r, i) => (
              <tr key={r.check} style={{ borderBottom: i < PRIOR_VALIDATION_2026.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{r.check}</td>
                <td style={numCellStyle}>{r.tucuxi.toFixed(6)}</td>
                <td style={numCellStyle}>{r.reference.toFixed(6)}</td>
                <td style={numCellStyle}>{(Math.abs(r.tucuxi - r.reference) / r.reference).toExponential(1)}</td>
                <td style={{ ...cellStyle, color: r.ok ? "#047857" : "#b91c1c", fontWeight: 700 }}>{r.ok ? "pass" : "FAIL"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        Reference values are the closed-form and matrix-exponential oracle values documented on the Literature
        Reproducibility page. Unlike the {CROSSCHECK_META.displayDate} snapshot, the prior calculation itself was
        therefore compared, not only the fit.
      </p>
    </section>
  );
}

function ResultCard2026() {
  const s = AGREEMENT_2026;
  const c = CRITERIA_2026;
  const e = EXPOSURE_AGREEMENT_2026;
  const criteria = [
    { label: "Clearance median |Δ| ≤ 2%", value: `${s.CL.median_abs_pct.toFixed(2)}%`, met: c.CL_median_abs_pct_le_2 },
    { label: "Clearance 95th percentile |Δ| ≤ 10%", value: `${s.CL.p95_abs_pct.toFixed(2)}%`, met: c.CL_p95_abs_pct_le_10 },
    { label: "Central volume median |Δ| ≤ 3%", value: `${s.V1.median_abs_pct.toFixed(2)}%`, met: c.V1_median_abs_pct_le_3 },
    { label: "Failed or excluded fits ≤ 2% of cohort", value: `${c.excluded} of ${CROSSCHECK_META_2026.n}`, met: c.excluded_le_2pct },
    { label: `Every |Δ CL| > 10% explained individually`, value: `${c.outliers_over_10pct} such cases`, met: c.outliers_over_10pct === 0 },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Agreement between the two programs · n = {CROSSCHECK_META_2026.n}</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Difference between the two programs&rsquo; individual (posterior) estimates, Vancomyzer relative to
        Tucuxi, per parameter. Q and V₂ are reported without a criterion: two levels barely inform them, so both
        programs stay near the shared prior.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Parameter</th>
              <th style={numCellStyle}>median |Δ|</th>
              <th style={numCellStyle}>mean signed Δ</th>
              <th style={numCellStyle}>p90 |Δ|</th>
              <th style={numCellStyle}>p95 |Δ|</th>
              <th style={numCellStyle}>max |Δ|</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER_2026.map((k, i) => {
              const row = s[k];
              return (
                <tr key={k} style={{ borderBottom: i < PARAM_ORDER_2026.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                  <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{PARAM_LABEL[k]}</td>
                  <td style={numCellStyle}>{row.median_abs_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.mean_signed_pct >= 0 ? "+" : ""}{row.mean_signed_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.p90_abs_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.p95_abs_pct.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.max_abs_pct.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "14px 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-dim)" }}>
        Acceptance criteria (fixed 17 Sep 2026, before the run)
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
        {criteria.map((r) => (
          <li key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "5px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 3 }}>
            <span style={{ color: "var(--color-secondary)" }}>{r.label}</span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}>
              {r.value} <strong style={{ color: r.met ? "#047857" : "#b91c1c" }}>{r.met ? "met" : "not met"}</strong>
            </span>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        Steady-state exposure computed from each program&rsquo;s own estimates: AUC₂₄ median |Δ|{" "}
        {e.auc24.median_abs_pct.toFixed(2)}% (95th percentile {e.auc24.p95_abs_pct.toFixed(2)}%, maximum{" "}
        {e.auc24.max_abs_pct.toFixed(2)}%), peak {e.peak.median_abs_pct.toFixed(2)}%, trough{" "}
        {e.trough.median_abs_pct.toFixed(2)}% (maximum {e.trough.max_abs_pct.toFixed(2)}%; the trough is the
        quantity most sensitive to clearance). Meeting these criteria means the two fitting implementations agree
        on this synthetic cohort; it does not mean the programs are interchangeable in practice.
      </p>
    </section>
  );
}

function AccuracyCard2026() {
  const a = ACCURACY_VS_TRUTH_2026;
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Error against the known synthetic truth</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Because the patients are simulated, their &ldquo;true&rdquo; parameters are known. Median absolute
        percentage error of each program&rsquo;s estimates against that truth, with the unfitted prior for
        reference (lower is better).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Parameter</th>
              <th style={numCellStyle}>prior (no fit)</th>
              <th style={numCellStyle}>Vancomyzer</th>
              <th style={numCellStyle}>Tucuxi</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER_2026.map((k, i) => (
              <tr key={k} style={{ borderBottom: i < PARAM_ORDER_2026.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{PARAM_LABEL[k]}</td>
                <td style={{ ...numCellStyle, color: "var(--color-dim)" }}>{a[k].prior.toFixed(1)}%</td>
                <td style={numCellStyle}>{a[k].vz.toFixed(1)}%</td>
                <td style={numCellStyle}>{a[k].tucuxi.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        As in the earlier comparison, only <strong>clearance</strong> improves materially with a two-level fit
        ({a.CL.prior.toFixed(1)}% with the prior alone, {a.CL.vz.toFixed(1)}% for Vancomyzer,{" "}
        {a.CL.tucuxi.toFixed(1)}% for Tucuxi). The synthetic truth comes from a different published model
        (Goti 2018) than the prior, so this is a check that the fit moves toward the truth, not a claim about
        accuracy in patients.
      </p>
    </section>
  );
}

function AttributionCard() {
  const rows = ATTRIBUTION_2026.cases;
  const worst = rows[0];
  const maxRefitErr = Math.max(...rows.flatMap((r) => [Math.abs(r.refit_vform_vs_vancomyzer_pct), Math.abs(r.refit_tform_vs_tucuxi_pct)]));
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Largest disagreements — and why</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        The two programs weight a measured level differently. Vancomyzer&rsquo;s assay-error model is{" "}
        <code>σ = max(1, 0.15 × max(observed, predicted))</code>; Tucuxi&rsquo;s standard &ldquo;mixed&rdquo;
        model is <code>σ = √((0.15 × predicted)² + 1²)</code>. They are close when a level is near its
        prediction and diverge when a level is well above it. To test whether that explains the tail, every
        patient with a clearance difference of {ATTRIBUTION_2026.threshold_pct}% or more ({rows.length} of{" "}
        {CROSSCHECK_META_2026.n}) was re-fitted by a third, independent estimator (numpy/scipy, sharing no code
        with either program) under each error model in turn.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Patient</th>
              <th style={numCellStyle}>Vancomyzer CL</th>
              <th style={numCellStyle}>Tucuxi CL</th>
              <th style={numCellStyle}>Δ</th>
              <th style={numCellStyle}>refit, Vancomyzer σ vs Vancomyzer</th>
              <th style={numCellStyle}>refit, Tucuxi σ vs Tucuxi</th>
              <th style={numCellStyle}>σ form alone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)" }}>{r.id}</td>
                <td style={numCellStyle}>{r.vancomyzer_CL.toFixed(3)}</td>
                <td style={numCellStyle}>{r.tucuxi_CL.toFixed(3)}</td>
                <td style={{ ...numCellStyle, fontWeight: 600, color: "var(--color-primary)" }}>{r.dCL_pct_vanco_vs_tucuxi >= 0 ? "+" : ""}{r.dCL_pct_vanco_vs_tucuxi.toFixed(2)}%</td>
                <td style={numCellStyle}>{r.refit_vform_vs_vancomyzer_pct >= 0 ? "+" : ""}{r.refit_vform_vs_vancomyzer_pct.toFixed(2)}%</td>
                <td style={numCellStyle}>{r.refit_tform_vs_tucuxi_pct >= 0 ? "+" : ""}{r.refit_tform_vs_tucuxi_pct.toFixed(2)}%</td>
                <td style={numCellStyle}>{r.form_effect_pct >= 0 ? "+" : ""}{r.form_effect_pct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        The independent refit reproduces each program to within {maxRefitErr.toFixed(2)}% under its own error
        model, and the error-model form alone accounts for the whole difference in every case (largest:{" "}
        {worst.id}, {worst.dCL_pct_vanco_vs_tucuxi.toFixed(2)}%). No optimiser, convergence, boundary or
        model-integration difference was found. Unlike the {CROSSCHECK_META.displayDate} snapshot, no
        disagreement is left unexplained. Whether Vancomyzer&rsquo;s error model — which gives a little less weight
        to a level that comes back unexpectedly high — is the preferable choice is a clinical design question that
        this analysis records rather than settles.
      </p>
    </section>
  );
}

function MethodologyCard2026() {
  const m = CROSSCHECK_META_2026;
  const sd = m.priorLogSd;
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Method</h2>
      <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: "var(--color-secondary)" }}>
        <li>
          Generate {m.n} synthetic ICU patients (seed {m.seed}) with &ldquo;true&rdquo; parameters drawn from a
          Goti 2018–based model; simulate two levels with assay error ({m.design}). The test data are available in the source repository.
        </li>
        <li>
          Run Vancomyzer&rsquo;s calculator (calculation version {m.engineManifest}) on each patient: {COLIN_2019.shortName}{" "}
          prior from the covariates, then the Bayesian fit on the two levels.
        </li>
        <li>
          Use the Colin 2019 equations in Tucuxi with prior variability
          (log-scale SD: CL {sd.CL}, V₁ {sd.V1}, Q {sd.Q}, V₂ {sd.V2}) and Tucuxi&rsquo;s mixed residual error
          (1.0 mg/L additive, 15% proportional). Check its prior-only prediction against the reference patient
          (table above). Then give Tucuxi the same dosing history and the same two levels per patient and run its
          Bayesian fit.
        </li>
        <li>
          Score the two sets of estimates with the published analysis against the criteria written
          down on 17 Sep 2026, before the run; re-fit every tail case independently under both error models.
        </li>
      </ol>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}>
        Comparator: {m.comparator}. The exact program version, test data, model definitions and analysis scripts are available in the <a href="https://github.com/marioce75/vancomyzer_website/tree/design/direction-a/website/src/lib/validation/crosscheck" style={{ textDecoration: "underline" }}>reproducibility materials</a>.
      </p>
    </section>
  );
}

function ScopeCard2026() {
  const limits = [
    {
      label: "Checks the fitting implementation, not clinical accuracy",
      body: "Both programs used the same Colin 2019 prior (Tucuxi evaluating the equations from its own model file) and the same simulated data. Agreement shows that two independently written Bayesian estimators reach the same answer on the same problem. It does not show that Colin 2019 is the right model for any population, and it says nothing about accuracy in patients.",
    },
    {
      label: "Error models differ by design",
      body: "The two programs' residual error models are not identical in form, and this difference accounts for the entire tail of the distribution. The comparison therefore also functions as a sensitivity analysis of that choice: up to about 9% in clearance for individual synthetic patients whose level came back well above prediction.",
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
      <h2 style={sectionTitleStyle}>Scope &amp; limitations</h2>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
        {limits.map((l) => (
          <li key={l.label} style={{ padding: "10px 12px", borderLeft: "3px solid #d97706", background: "#fffbeb", marginBottom: 8, borderRadius: 3 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>{l.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>{l.body}</p>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
        <strong>What this shows:</strong> given the same prior and the same simulated data, Vancomyzer and Tucuxi
        produce individual estimates that agree within the pre-set criteria for all {CROSSCHECK_META_2026.n}{" "}
        synthetic patients, with every larger difference explained. <strong>What it does not show:</strong> that
        the Colin 2019 equations are clinically correct, that either error model is the right one, or that
        Vancomyzer is accurate in real patients.
      </p>
    </section>
  );
}

function Breadcrumb() {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
      <Link href="/transparent-dosing" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
         Evidence
      </Link>
      <span style={{ color: "var(--color-border)" }}>·</span>
      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Comparison with Tucuxi</span>
    </div>
  );
}

function SnapshotNotice() {
  return (
    <div style={{
      padding: "14px 18px",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      borderLeft: "3px solid #2563eb",
      color: "#14232f",
      borderRadius: 4,
      fontSize: 13,
      lineHeight: 1.55,
      marginBottom: 24,
    }}>
      <strong>Results from {CROSSCHECK_META.displayDate}.</strong> The developer ran this comparison once,
      with the {CROSSCHECK_META.engineVersion}. It has not been re-run since, and running Tucuxi requires a
      separate local installation, so it is not part of the site build. The figures below are read directly
      from that run&rsquo;s saved results.{" "}
      This is an archived software-version comparison, not an evaluation of the current release.
      Model settings and prior assumptions differ from the current implementation. These figures must
      not be used to claim current-product accuracy or independent clinical validation.
    </div>
  );
}

function ResultCard() {
  const s = CROSSCHECK.summary;
  const medians = PARAM_ORDER.map((k) => s[k].median_abs);
  const p95s = PARAM_ORDER.map((k) => s[k].p95_abs);
  const maxes = PARAM_ORDER.map((k) => s[k].max_abs);
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Agreement between the two programs · n = {CROSSCHECK.n}</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Relative difference between the two programs&rsquo; individual (posterior) estimates, as a percentage of
        the mean of the two, per parameter. Both were given the <em>same</em> prior and the <em>same</em> two
        simulated levels.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Parameter</th>
              <th style={numCellStyle}>median |Δ|</th>
              <th style={numCellStyle}>mean signed Δ</th>
              <th style={numCellStyle}>p90 |Δ|</th>
              <th style={numCellStyle}>p95 |Δ|</th>
              <th style={numCellStyle}>max |Δ|</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER.map((k, i) => {
              const row = s[k];
              return (
                <tr key={k} style={{ borderBottom: i < PARAM_ORDER.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                  <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{PARAM_LABEL[k]}</td>
                  <td style={numCellStyle}>{row.median_abs.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.mean_signed >= 0 ? "+" : ""}{row.mean_signed.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.p90_abs.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.p95_abs.toFixed(2)}%</td>
                  <td style={numCellStyle}>{row.max_abs.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        Observed agreement: median absolute differences of {range(medians, 2)}% across the four parameters,
        95th percentiles of {range(p95s, 2)}%, and maximum differences of {range(maxes, 2)}% (clearance:
        median {s.CL.median_abs.toFixed(2)}%, 95th percentile {s.CL.p95_abs.toFixed(2)}%, maximum{" "}
        {s.CL.max_abs.toFixed(2)}%; central volume: {s.V1.median_abs.toFixed(2)}%, {s.V1.p95_abs.toFixed(2)}%
        and {s.V1.max_abs.toFixed(2)}%). No equivalence margins were set before the run, so these numbers describe
        the agreement that was observed; they are not a test of whether the programs are interchangeable.
      </p>
    </section>
  );
}

function AccuracyCard() {
  const a = CROSSCHECK.accuracy_vs_truth;
  const gaps = PARAM_ORDER.map((k) => Math.abs(a[k].vz - a[k].tucuxi));
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Error against the known synthetic truth</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Because the patients are simulated, their &ldquo;true&rdquo; parameters are known. Median absolute
        percentage error of each program&rsquo;s estimates against that truth, with the unfitted prior for
        reference (lower is better).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Parameter</th>
              <th style={numCellStyle}>prior (no fit)</th>
              <th style={numCellStyle}>Vancomyzer</th>
              <th style={numCellStyle}>Tucuxi</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER.map((k, i) => (
              <tr key={k} style={{ borderBottom: i < PARAM_ORDER.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{PARAM_LABEL[k]}</td>
                <td style={{ ...numCellStyle, color: "var(--color-dim)" }}>{a[k].prior.toFixed(1)}%</td>
                <td style={numCellStyle}>{a[k].vz.toFixed(1)}%</td>
                <td style={numCellStyle}>{a[k].tucuxi.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        The two programs&rsquo; median errors differed by {range(gaps, 1)} percentage points per parameter. No
        equivalence margins were prespecified. Only <strong>clearance</strong> improved materially with the
        two-level fit ({a.CL.prior.toFixed(1)}% with the prior alone, {a.CL.vz.toFixed(1)}% for Vancomyzer and{" "}
        {a.CL.tucuxi.toFixed(1)}% for Tucuxi). The inter-compartmental clearance and peripheral volume (Q, V₂)
        barely moved: a steady-state peak and trough carry little information about them, so both programs
        stayed near the shared prior. Similar errors are expected when two programs fit the same model to the
        same data; this is synthetic truth, not accuracy in patients.
      </p>
    </section>
  );
}

function OutlierCard({ audit }: { audit: ReturnType<typeof auditCrosscheckCohort> }) {
  const highBmiIds = new Set(audit.cohort_matches_report ? audit.high_bmi.map((p) => p.id) : []);
  const cl = CROSSCHECK.outliers.CL;
  const v1 = CROSSCHECK.outliers.V1;
  const listed = [...cl, ...v1];
  const crcls = listed.map((o) => o.crcl);
  const aboveArc = new Set(listed.filter((o) => o.crcl > 130).map((o) => o.id));
  const highBmiListed = audit.high_bmi.filter((p) => listed.some((o) => o.id === p.id));
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Largest disagreements</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        The five largest differences recorded for clearance and central volume (patient id, creatinine clearance
        in mL/min, difference).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <OutlierMini title="Clearance (CL)" rows={cl} highBmiIds={highBmiIds} />
        <OutlierMini title="Central volume (V₁)" rows={v1} highBmiIds={highBmiIds} />
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        The largest disagreements are not confined to patients with augmented renal clearance. Creatinine
        clearance for the patients listed ranges from {Math.min(...crcls).toFixed(0)} to{" "}
        {Math.max(...crcls).toFixed(0)} mL/min, and {aboveArc.size} of the {new Set(listed.map((o) => o.id)).size}{" "}
        patients listed are above 130 mL/min.
        {audit.cohort_matches_report && highBmiListed.length > 0 && (
          <>
            {" "}Listed patients with a BMI of 40 or more:{" "}
            {highBmiListed.map((p) => `${p.id} (BMI ${p.bmi.toFixed(1)})`).join(" and ")}. These cases belong to the archived software version. Differences in prior settings between
            the compared implementations were not fully recorded, so attribution remains unresolved.
          </>
        )}
        {" "}These individual disagreements have not been explained and should be investigated.
      </p>
    </section>
  );
}

function OutlierMini({ title, rows, highBmiIds }: { title: string; rows: Outlier[]; highBmiIds: Set<string> }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-dim)" }}>{title}</p>
      {rows.map((o) => (
        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "3px 0", fontFamily: "var(--font-mono, monospace)" }}>
          <span style={{ color: "var(--color-secondary)" }}>
            {o.id} · CrCl {o.crcl}{highBmiIds.has(o.id) ? " · BMI ≥ 40" : ""}
          </span>
          <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{o.delta_pct >= 0 ? "+" : ""}{o.delta_pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function MethodologyCard() {
  const sd = CROSSCHECK_META.documentedTucuxiPriorLogSd;
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Method</h2>
      <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: "var(--color-secondary)" }}>
        <li>
          Generate {CROSSCHECK.n} synthetic ICU patients (seed {CROSSCHECK_META.seed}, the same generator as the
          Predictive Performance page), with &ldquo;true&rdquo; parameters drawn from a Goti 2018–based model.
        </li>
        <li>
          Simulate a steady-state peak and trough for each patient, with simulated residual error.
        </li>
        <li>
          Compute per-patient priors using the archived software version, then run that version&rsquo;s Bayesian fit on
          the two levels to estimate CL, V₁, Q and V₂.
        </li>
        <li>
          Give Tucuxi a model file written by Vancomyzer ({CROSSCHECK_META.structuralModel}) containing
          Vancomyzer&rsquo;s prior values for that patient, with prior variability (log-scale SD: CL {sd.CL}, V₁{" "}
          {sd.V1}, Q {sd.Q}, V₂ {sd.V2}) and residual error ({CROSSCHECK_META.documentedTucuxiResidualError}) chosen
          to approximate Vancomyzer&rsquo;s settings, plus the same dosing history and the same two levels. Run
          Tucuxi&rsquo;s Bayesian fit.
        </li>
        <li>
          Compare the two programs&rsquo; estimates parameter by parameter. The analysis checked that all{" "}
          {CROSSCHECK.n} patients were present before summarizing.
        </li>
      </ol>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}>
        Comparator: {CROSSCHECK_META.comparator} ({CROSSCHECK_META.comparatorRepo}, commit{" "}
        {CROSSCHECK_META.comparatorCommit}), an open-source dosing program developed by the REDS institute at
        HEIG-VD, Switzerland. The one-off scripts used for the run, and the per-patient inputs, were not committed
        to the repository.
      </p>
    </section>
  );
}

function ScopeCard() {
  const limits = [
    {
      label: "Checks the fitting implementation, not the Colin equations or clinical accuracy",
      body: "Both programs were given the same priors and a Colin model file written by Vancomyzer (a Colin 2019 file that Tucuxi can load was not publicly available). Agreement therefore shows that the two programs fit the same model to the same data in a similar way. It does not independently confirm the Colin 2019 equations (those are checked against published values on the Literature Reproducibility page), and it says nothing about accuracy in patients.",
    },
    {
      label: "Same starting estimate",
      body: "Tucuxi was given Vancomyzer's starting estimate for each patient, so the prior calculation itself was not compared.",
    },
    {
      label: "Simulated patients only",
      body: "The patients and their levels are computer-generated. Real-patient performance has not been evaluated; the Predictive Performance analysis is also synthetic.",
    },
    {
      label: "Two-level sampling",
      body: "A steady-state peak and trough mainly inform clearance. Agreement on Q and V₂ largely reflects both programs staying near the shared starting estimate.",
    },
    {
      label: "Run date and calculator version",
      body: `Run once on ${CROSSCHECK_META.displayDate} with the ${CROSSCHECK_META.engineVersion}. It has not been repeated with the current calculator.`,
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Scope &amp; limitations</h2>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
        {limits.map((l) => (
          <li key={l.label} style={{ padding: "10px 12px", borderLeft: "3px solid #d97706", background: "#fffbeb", marginBottom: 8, borderRadius: 3 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>{l.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>{l.body}</p>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
        <strong>What this shows:</strong> given the same priors, model file and simulated data, Tucuxi and
        Vancomyzer produced similar individual estimates for most of the {CROSSCHECK.n} synthetic patients, with
        some larger individual differences that have not been explained. <strong>What it does not show:</strong>{" "}
        that the Colin 2019 equations are correct, that the two programs are interchangeable, or that Vancomyzer
        is accurate in real patients.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: 18,
  marginBottom: 20,
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-primary)",
  margin: 0,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
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
