/**
 * /transparent-dosing/predictive-performance — Predictive Performance page.
 *
 * A developer-run synthetic analysis (not real patients). The page runs the
 * harness in src/lib/validation/predictive when the site is built, with the
 * fixed seed and cohort size used by scripts/verify-predictive-performance.ts,
 * so it shows the same numbers the script prints.
 *
 * Design (see runValidation.ts): 200 synthetic ICU-like adults; truth from a
 * Goti 2018-based model with developer-chosen weight scaling and
 * variability; two fitted steady-state levels (3.0 h and 11.5 h); one
 * held-out concentration at 6.0 h, compared with a noisy synthetic
 * observation and, separately, with the noise-free truth.
 *
 * Bai et al. 2025 (real ICU patients) is shown in a separate section for
 * context. Its cohort, sampling and truth definition differ, so its numbers
 * are not comparable with the synthetic results.
 */

import Link from "next/link";
import {
  PREDICTIVE_DEFAULT_N,
  PREDICTIVE_DEFAULT_SEED,
  PREDICTIVE_DESIGN,
  runPredictiveValidation,
  type RunOutput,
} from "@/lib/validation/predictive/runValidation";
import {
  BAI_2025_A_POSTERIORI,
  BAI_2025_REFERENCE,
  METRIC_DEFINITIONS,
  computeMetrics,
  type PerformanceMetrics,
} from "@/lib/validation/predictive/metrics";
import {
  GOTI_2018_THETA,
  GOTI_2018_OMEGA,
  GOTI_2018_RESIDUAL,
} from "@/lib/validation/predictive/goti2018";
import { COLIN_2019, MODEL_MANIFEST_VERSION } from "@/lib/pk/modelRegistry";

export const metadata = {
  title: "Predictive Performance — Vancomyzer",
  description:
    "A developer-run synthetic analysis (not real patients): Vancomyzer's Bayesian engine predicts a held-out " +
    "vancomycin concentration in 200 simulated ICU patients generated from a different model. " +
    "Vancomyzer has not yet been validated in real patients.",
};

export default function PredictivePerformancePage() {
  const run = runPredictiveValidation({ seed: PREDICTIVE_DEFAULT_SEED, n: PREDICTIVE_DEFAULT_N });
  const vsObservation = computeMetrics(run.pairs_vs_observation);
  const vsTruth = computeMetrics(run.pairs_vs_truth);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Predictive Performance
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 760 }}>
        A developer-run synthetic analysis (not real patients). For each of {run.n_attempted} simulated
        ICU patients, Vancomyzer&rsquo;s Bayesian engine is fitted to two simulated vancomycin levels
        and then predicts a third concentration that was not used in the fit. The simulated
        patients&rsquo; &ldquo;true&rdquo; pharmacokinetics come from a different model than the one
        Vancomyzer uses.
      </p>

      <StatusNotice />

      <DesignCard run={run} />

      <ResultsCard run={run} vsObservation={vsObservation} vsTruth={vsTruth} />

      <DefinitionsCard />

      <PublishedContextCard />

      <LimitationsCard run={run} />

      <NextStepsCard />
    </div>
  );
}

function Breadcrumb() {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 16, flexWrap: "wrap" }}>
      <Link href="/transparent-dosing" style={{ color: "var(--color-dim)", textDecoration: "none" }}>
        ← Transparent Dosing
      </Link>
      <span style={{ color: "var(--color-border)" }}>·</span>
      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Predictive Performance</span>
    </div>
  );
}

function StatusNotice() {
  return (
    <div style={{
      padding: "14px 18px",
      background: "#fffbeb",
      border: "1px solid #fcd34d",
      borderLeft: "3px solid #d97706",
      color: "#78350f",
      borderRadius: 4,
      fontSize: 13,
      lineHeight: 1.55,
      marginBottom: 24,
    }}>
      <strong>Vancomyzer has not yet been validated in real patients.</strong> Its equations are
      checked against published values and synthetic test cases; external validation with patient
      data is planned. The results below come from a developer-run synthetic analysis (not real
      patients). They do not show how Vancomyzer performs in patients.
    </div>
  );
}

function fmt(v: number, digits = 2): string {
  return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function fmtSigned(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}

function DesignCard({ run }: { run: RunOutput }) {
  const d = PREDICTIVE_DESIGN;
  const c = run.cohort;
  const [tPeak, tTrough] = d.fitted_sample_times_hours;
  const rows: { label: string; body: React.ReactNode }[] = [
    {
      label: "Analysis",
      body: (
        <>
          Developer-run synthetic analysis (not real patients). Recomputed from the source code each time
          the site is built: seed {run.seed}, n = {run.n_attempted}.
        </>
      ),
    },
    {
      label: "Engine",
      body: (
        <>
          Vancomyzer a posteriori (Bayesian) engine with the {COLIN_2019.shortName} prior. Model manifest
          version <code>{MODEL_MANIFEST_VERSION}</code>.
        </>
      ),
    },
    {
      label: "Synthetic population",
      body: (
        <>
          {run.n_attempted} adults (age {Math.round(c.age_range[0])}–{Math.round(c.age_range[1])} years,
          {" "}{c.n_male} male). Age, sex, weight and serum creatinine are drawn from distributions calibrated
          to summary statistics of the Bai et al. 2025 ICU cohort (median weight{" "}
          {c.median_weight_kg.toFixed(1)} kg, median serum creatinine {c.median_scr_mg_dl.toFixed(2)} mg/dL);
          height uses developer-chosen values.
          No dialysis, CRRT or ECMO. Augmented renal clearance is not excluded: Cockcroft–Gault CrCl is
          capped at {c.crcl_cap_ml_min} mL/min, {c.n_crcl_above_130} patients are above 130 mL/min and
          {" "}{c.n_crcl_at_cap} of them are at the cap. {c.n_bmi_40_or_more} patients have a BMI of 40 or more.
        </>
      ),
    },
    {
      label: "Truth model",
      body: (
        <>
          Goti 2018–based model, different from Vancomyzer&rsquo;s prior: CL = {GOTI_2018_THETA.CL} ×
          (CrCl/120)<sup>0.8</sup> × (WT/70)<sup>0.75</sup> L/h, V<sub>1</sub> = {GOTI_2018_THETA.V1} × WT/70 L,
          Q = {GOTI_2018_THETA.Q} × (WT/70)<sup>0.75</sup> L/h, V<sub>2</sub> = {GOTI_2018_THETA.V2} × WT/70 L,
          with log-normal between-subject variability (ω<sub>CL</sub> = {GOTI_2018_OMEGA.CL},
          ω<sub>V1</sub> = {GOTI_2018_OMEGA.V1}, ω<sub>Q</sub> = {GOTI_2018_OMEGA.Q},
          ω<sub>V2</sub> = {GOTI_2018_OMEGA.V2}). The weight terms and the variability values are developer
          choices, not Goti 2018 estimates.
        </>
      ),
    },
    {
      label: "Regimen",
      body: (
        <>
          {d.dose_mg_per_kg} mg/kg every {d.interval_hours} h, {d.dose_rounding}, infused over{" "}
          {d.infusion_hours} h. No dose changes.
        </>
      ),
    },
    {
      label: "Fitted samples",
      body: (
        <>
          Two levels in the dosing interval of dose {d.sampled_dose_number}: {tPeak.toFixed(1)} h after the start
          of the dose ({(tPeak - d.infusion_hours).toFixed(1)} h after the end of the infusion) and{" "}
          {tTrough.toFixed(1)} h ({(d.interval_hours - tTrough).toFixed(1)} h before the next dose). Each has
          simulated residual error ({(GOTI_2018_RESIDUAL.proportional * 100).toFixed(0)}% proportional +{" "}
          {GOTI_2018_RESIDUAL.additive_mg_l.toFixed(1)} mg/L additive). The simulation and the fit both use
          steady-state equations.
        </>
      ),
    },
    {
      label: "Endpoint",
      body: (
        <>
          The concentration {d.heldout_sample_time_hours.toFixed(1)} h after the start of the same dose
          ({d.heldout_hours_after_infusion_end.toFixed(1)} h after the end of the infusion), predicted from
          the fitted engine. This time is not used in the fit. The prediction is compared with (a) a synthetic
          observation at that time (truth plus residual error) and (b) the noise-free truth, reported
          separately.
        </>
      ),
    },
    {
      label: "Fits",
      body: (
        <>
          {run.n_fit_succeeded} of {run.n_attempted} posterior fits succeeded; the metrics use the successful
          fits.
        </>
      ),
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>What was run</h2>
      <dl style={{ margin: "12px 0 0", display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 150px) minmax(0, 1fr)", gap: 12, fontSize: 13, lineHeight: 1.6 }}>
            <dt style={{ margin: 0, fontWeight: 700, color: "var(--color-primary)" }}>{r.label}</dt>
            <dd style={{ margin: 0, color: "var(--color-secondary)" }}>{r.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ResultsCard({ run, vsObservation, vsTruth }: { run: RunOutput; vsObservation: PerformanceMetrics; vsTruth: PerformanceMetrics }) {
  const t = PREDICTIVE_DESIGN.heldout_sample_time_hours.toFixed(1);
  const rows: { label: string; m: PerformanceMetrics }[] = [
    { label: `Synthetic observation at ${t} h (truth + residual error)`, m: vsObservation },
    { label: `Noise-free truth at ${t} h`, m: vsTruth },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Results · developer-run synthetic analysis (not real patients)</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Error of the engine&rsquo;s prediction at the held-out time, one prediction per patient
        (seed {run.seed}, model manifest {MODEL_MANIFEST_VERSION}). Metric definitions are below.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Prediction compared with</th>
              <th style={numCellStyle}>n</th>
              <th style={numCellStyle}>Bias (mg/L)</th>
              <th style={numCellStyle}>rBias (%)</th>
              <th style={numCellStyle}>RMSE (mg/L)</th>
              <th style={numCellStyle}>rRMSE (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{r.label}</td>
                <td style={numCellStyle}>{r.m.n}</td>
                <td style={numCellStyle}>{fmtSigned(r.m.bias_mg_l)}</td>
                <td style={numCellStyle}>{fmtSigned(r.m.rbias_pct)}</td>
                <td style={numCellStyle}>{fmt(r.m.rmse_mg_l)}</td>
                <td style={numCellStyle}>{fmt(r.m.rrmse_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        Error against the synthetic observation includes the residual error added to that observation, so it
        is larger than error against the noise-free truth; relative errors are inflated most when the
        observed concentration is low. No acceptance threshold was prespecified for this analysis. Each
        patient contributes one held-out concentration from one steady-state interval, which is a narrow
        test (see Limitations).
      </p>
    </section>
  );
}

function DefinitionsCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Metric definitions</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 10, lineHeight: 1.55 }}>
        C<sub>pred</sub> is the engine&rsquo;s predicted concentration and C<sub>ref</sub> is the value it is
        compared with (the synthetic observation or the noise-free truth). Means are taken over patients.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {METRIC_DEFINITIONS.map((m, i) => (
              <tr key={m.key} style={{ borderBottom: i < METRIC_DEFINITIONS.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, fontWeight: 700, color: "var(--color-primary)", whiteSpace: "nowrap" }}>{m.label}</td>
                <td style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}>{m.formula}</td>
                <td style={{ ...cellStyle, color: "var(--color-secondary)" }}>{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        Bias and precision as measures of predictive performance follow Sheiner and Beal (J Pharmacokinet
        Biopharm. 1981;9:503–512). Some later studies treat an rBias within ±20% as acceptable; that threshold
        is a convention, not a criterion set by Sheiner and Beal, and it was not prespecified here.
      </p>
    </section>
  );
}

function PublishedContextCard() {
  return (
    <section style={{ ...cardStyle, background: "var(--color-bg)", borderStyle: "dashed" }}>
      <h2 style={sectionTitleStyle}>Published real-patient study · context only, not comparable</h2>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 8, marginBottom: 10, lineHeight: 1.6 }}>
        <strong>These numbers cannot be compared with the synthetic results above.</strong> Bai et al. evaluated
        three Bayesian dosing programs in real ICU patients. The cohort, sampling, dosing and definition of
        the true value (measured concentrations) all differ from the synthetic analysis, and Vancomyzer was
        not part of the study. {BAI_2025_REFERENCE.cohort}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <caption style={{ captionSide: "top", textAlign: "left", fontSize: 11, color: "var(--color-dim)", paddingBottom: 6 }}>
            Bai et al. 2025, Table 3, a posteriori predictions in real ICU patients
          </caption>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Program (model)</th>
              <th style={numCellStyle}>Bias (mg/L)</th>
              <th style={numCellStyle}>rBias (%)</th>
              <th style={numCellStyle}>RMSE (mg/L)</th>
              <th style={numCellStyle}>rRMSE (%)</th>
            </tr>
          </thead>
          <tbody>
            {BAI_2025_A_POSTERIORI.map((r, i) => (
              <tr key={r.program} style={{ borderBottom: i < BAI_2025_A_POSTERIORI.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                <td style={{ ...cellStyle, color: "var(--color-primary)" }}>{r.program}</td>
                <td style={numCellStyle}>{fmtSigned(r.bias_mg_l)}</td>
                <td style={numCellStyle}>{fmtSigned(r.rbias_pct)}</td>
                <td style={numCellStyle}>{fmt(r.rmse_mg_l)}</td>
                <td style={numCellStyle}>{fmt(r.rrmse_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "var(--color-dim)", marginTop: 10, marginBottom: 0, lineHeight: 1.55 }}>
        Source: {BAI_2025_REFERENCE.source}{" "}
        <a href={`https://doi.org/${BAI_2025_REFERENCE.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>
          doi:{BAI_2025_REFERENCE.doi}
        </a>
      </p>
    </section>
  );
}

function LimitationsCard({ run }: { run: RunOutput }) {
  const c = run.cohort;
  const d = PREDICTIVE_DESIGN;
  const limits: { label: string; body: string }[] = [
    {
      label: "Synthetic patients, not real patients",
      body: "The truth model contains only the variability that was simulated. It leaves out things that happen in real patients, such as changing renal function, fluid shifts, drug interactions, errors in dose or sample times, and assay problems. Error in real patients has not been measured and could be larger.",
    },
    {
      label: "One held-out concentration in one steady-state interval",
      body: `Each patient contributes one held-out concentration, ${d.heldout_sample_time_hours.toFixed(1)} h into the same steady-state interval as the two fitted levels (between the two fitted sample times). There are no dose changes, no levels before steady state and no change in physiology over time. This is held-out interpolation, not future forecasting: it does not show how well Vancomyzer forecasts later levels after a regimen change or as a patient's condition changes.`,
    },
    {
      label: "Two-level sampling only",
      body: "The engine always receives two levels, one after the infusion and one before the next dose. Trough-only sampling and levels drawn before steady state were not simulated.",
    },
    {
      label: "Truth model is partly developer-defined",
      body: `Typical values come from Goti 2018, but the weight scaling, the between-subject variability (ω = ${GOTI_2018_OMEGA.CL} / ${GOTI_2018_OMEGA.V1} / ${GOTI_2018_OMEGA.Q} / ${GOTI_2018_OMEGA.V2}) and the residual error are developer choices. Different choices would change the results; the sensitivity has not been quantified.`,
    },
    {
      label: "Population coverage",
      body: `No dialysis, CRRT or ECMO patients are simulated. Augmented renal clearance is included (${c.n_crcl_above_130} of ${run.n_attempted} patients above 130 mL/min), but CrCl is capped at ${c.crcl_cap_ml_min} mL/min. Only ${c.n_bmi_40_or_more} patients have a BMI of 40 or more, so this analysis says little about high body weight.`,
    },
    {
      label: "Version",
      body: `Results reflect model manifest ${MODEL_MANIFEST_VERSION}, in which ${COLIN_2019.shortName} is used at every BMI. Versions of this page before 16 Sep 2026 used a since-retired custom model for patients with a BMI of 40 or more and evaluated the prediction at the same time as the fitted trough, so those earlier numbers are not comparable with these.`,
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Limitations</h2>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
        {limits.map((l) => (
          <li key={l.label} style={{ padding: "10px 12px", borderLeft: "3px solid #dc2626", background: "#fef2f2", marginBottom: 8, borderRadius: 3 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{l.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#7f1d1d", lineHeight: 1.55 }}>{l.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextStepsCard() {
  const stages = [
    {
      status: "Done",
      title: "Developer-run synthetic analysis (this page)",
      body: "Predictions checked against a different truth model in simulated patients. This does not validate Vancomyzer in real patients.",
    },
    {
      status: "Planned",
      title: "Retrospective evaluation with de-identified patient data",
      body: "Compare Vancomyzer's predictions with measured concentrations in a de-identified ICU dataset from a partner institution, with the analysis plan and acceptance criteria written before the data are analysed.",
    },
    {
      status: "Planned",
      title: "Prospective evaluation",
      body: "A prospective study in ICU patients, similar in design to published prospective evaluations of other dosing programs (for example, ter Heine et al. 2020).",
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Validation plan</h2>
      <div style={{ marginTop: 12 }}>
        {stages.map((s) => (
          <div key={s.title} style={{ padding: "12px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-dim)" }}>
              {s.status}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>{s.title}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.55 }}>{s.body}</p>
          </div>
        ))}
      </div>
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
  textAlign: "right",
};
