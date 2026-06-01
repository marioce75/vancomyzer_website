/**
 * /transparent-dosing/predictive-performance — Predictive Performance page.
 *
 * Runs the Vancomyzer engine against a synthetic ICU cohort whose
 * "truth" is generated from the Goti 2018 model (a published popPK
 * model different from Vancomyzer's Colin 2019 prior). Reports
 * Sheiner–Beal accuracy/precision metrics, directly comparable to the
 * three programs evaluated in Bai et al. Ther Drug Monit. 2025.
 *
 * Honest framing:
 *   - This is a SYNTHETIC stress test, not a real-patient study.
 *   - Real-world rRMSE will likely be HIGHER (more unmodeled physiology
 *     than a Goti+BSV truth generator captures).
 *   - Best-case sampling protocol: peak + trough at steady state.
 *     Trough-only and pre-steady-state would degrade the numbers.
 *   - This is stage 1 of a planned three-stage validation arc;
 *     the page documents the limitations explicitly.
 *
 * Deterministic — same seed every build, so the numbers on this page
 * are reproducible by anyone who runs `npm run test:predictive`.
 */

import Link from "next/link";
import { runPredictiveValidation } from "@/lib/validation/predictive/runValidation";
import { computeMetrics, BAI_2025_REFERENCE } from "@/lib/validation/predictive/metrics";
import {
  GOTI_2018_THETA,
  GOTI_2018_OMEGA,
  GOTI_2018_RESIDUAL,
} from "@/lib/validation/predictive/goti2018";

export const metadata = {
  title: "Predictive Performance — Vancomyzer",
  description:
    "Vancomyzer's Bayesian engine evaluated against a synthetic ICU cohort " +
    "generated from a different published popPK model (Goti 2018). Reports " +
    "Sheiner–Beal rBias and rRMSE — directly comparable to Bai et al. 2025.",
};

const SEED = 42;
const N = 200;

export default function PredictivePerformancePage() {
  const run = runPredictiveValidation({ seed: SEED, n: N });
  const metrics = computeMetrics(run.pairs);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Predictive Performance
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 760 }}>
        Vancomyzer&rsquo;s Bayesian engine evaluated against a synthetic ICU cohort
        whose &ldquo;true&rdquo; pharmacokinetics are generated from a different
        published popPK model (Goti 2018). Methodology mirrors Sheiner–Beal 1981
        and matches the table-3 convention of Bai et al. 2025 so the numbers below
        are directly comparable to the three programs in that study.
      </p>

      <ScientificCaveat />

      <ResultsCard metrics={metrics} run={run} />

      <ComparisonCard metrics={metrics} />

      <MethodologyCard />

      <LimitationsCard />

      <NextStagesCard />
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

function ScientificCaveat() {
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
      <strong>Synthetic stress test — not a real-patient study.</strong> This page
      reports performance on Monte Carlo–simulated patients whose true PK is
      drawn from a different published model than Vancomyzer&rsquo;s prior. Real
      ICU data will produce higher rRMSE (unmodeled physiology like sepsis-driven
      fluid shifts, drug interactions, and assay noise above the simulated 20%/1 mg·L
      combined error model). This is <strong>stage 1 of a three-stage validation arc</strong>;
      see &ldquo;Next stages&rdquo; below.
    </div>
  );
}

function ResultsCard({ metrics, run }: { metrics: ReturnType<typeof computeMetrics>; run: ReturnType<typeof runPredictiveValidation> }) {
  const passColor = metrics.rbias_acceptable ? "#047857" : "#b91c1c";
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Result · seed {run.seed} · n = {run.n_attempted}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 14 }}>
        <Metric label="rBias" value={`${metrics.rbias_pct.toFixed(2)}%`} sub={metrics.rbias_acceptable ? "✓ within ±20% (Sheiner–Beal)" : "✗ outside ±20%"} accent={passColor} />
        <Metric label="rRMSE" value={`${metrics.rrmse_pct.toFixed(2)}%`} sub="precision (lower is better)" accent="var(--color-primary)" />
        <Metric label="Bias" value={`${metrics.bias_mg_l >= 0 ? "+" : ""}${metrics.bias_mg_l.toFixed(2)} mg/L`} sub="mean absolute" accent="var(--color-secondary)" />
        <Metric label="RMSE" value={`${metrics.rmse_mg_l.toFixed(2)} mg/L`} sub="root mean squared" accent="var(--color-secondary)" />
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}>
        {run.n_fit_succeeded} of {run.n_attempted} posterior fits succeeded.
        Predictions evaluated at a <strong>held-out</strong> timepoint — trough 0.5 h
        before the next dose — not at the levels used to fit the posterior.
      </p>
    </section>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-dim)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: accent, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-dim)" }}>{sub}</p>
    </div>
  );
}

function ComparisonCard({ metrics }: { metrics: ReturnType<typeof computeMetrics> }) {
  const rows: { name: string; rbias: string; rrmse: string; note?: string }[] = [
    {
      name: "Vancomyzer (Colin 2019 prior) — synthetic Goti truth",
      rbias: `${metrics.rbias_pct.toFixed(2)}%`,
      rrmse: `${metrics.rrmse_pct.toFixed(2)}%`,
      note: "synthetic stress test (this page)",
    },
    { name: "SmartDose (He model) — real ICU patients",                rbias: "−8.73%",  rrmse: "37.64%", note: "Bai 2025" },
    { name: "Pharmado (Yasuhara model) — real ICU patients",           rbias: "−6.60%",  rrmse: "27.69%", note: "Bai 2025" },
    { name: "PrecisePK (Rodvold model) — real ICU patients",           rbias: "−16.03%", rrmse: "34.84%", note: "Bai 2025" },
    { name: "PrecisePK (Goti model) — real ICU patients",              rbias: "+0.10%",  rrmse: "34.56%", note: "Bai 2025" },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Comparison vs. Bai 2025 a posteriori</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Side-by-side with the four-program × real-ICU-patients table from Bai et al.{" "}
        <em>Direct numerical comparison is not valid</em> — we ran synthetic patients with one
        sampling protocol; Bai ran real patients with mixed sampling. The point of the table
        is order-of-magnitude reasonability: Vancomyzer&rsquo;s synthetic stress-test rBias and
        rRMSE land within the same range as commercial programs running on real ICU data.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Engine</th>
              <th style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)" }}>rBias</th>
              <th style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)" }}>rRMSE</th>
              <th style={cellStyle}>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none", background: i === 0 ? "#ecfdf5" : "transparent" }}>
                <td style={{ ...cellStyle, fontWeight: i === 0 ? 700 : 400, color: "var(--color-primary)" }}>{r.name}</td>
                <td style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{r.rbias}</td>
                <td style={{ ...cellStyle, fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{r.rrmse}</td>
                <td style={{ ...cellStyle, color: "var(--color-dim)", fontSize: 11 }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "var(--color-dim)", marginTop: 10, marginBottom: 0, lineHeight: 1.55 }}>
        Bai 2025 reference: rBias range <strong>{BAI_2025_REFERENCE.rbias_pct_range[0].toFixed(2)}% to {BAI_2025_REFERENCE.rbias_pct_range[1].toFixed(2)}%</strong>,
        rRMSE range <strong>{BAI_2025_REFERENCE.rrmse_pct_range[0].toFixed(2)}% to {BAI_2025_REFERENCE.rrmse_pct_range[1].toFixed(2)}%</strong>.
        Source: <em>{BAI_2025_REFERENCE.source}</em>
      </p>
    </section>
  );
}

function MethodologyCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Methodology</h2>
      <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: "var(--color-secondary)" }}>
        <li>
          Generate <strong>n = {N}</strong> synthetic ICU patients with demographics matched to
          Bai 2025 Table 2 (age 61.71 ± 14.78, 63.1% male, weight ~65 kg, SCr ~0.66 mg/dL).
          The patient set is fixed and reproducible, so the cohort is identical every time the analysis runs.
        </li>
        <li>
          For each patient, sample <strong>&ldquo;true&rdquo; PK parameters from the Goti 2018 model</strong>{" "}
          (CL = {GOTI_2018_THETA.CL} × (CrCl/120)<sup>0.8</sup> × (WT/70)<sup>0.75</sup> L/h,
          V<sub>1</sub> = {GOTI_2018_THETA.V1} × WT/70 L, Q = {GOTI_2018_THETA.Q} × (WT/70)<sup>0.75</sup> L/h,
          V<sub>2</sub> = {GOTI_2018_THETA.V2} × WT/70 L) plus log-normal BSV
          (ω<sub>CL</sub> = {GOTI_2018_OMEGA.CL}, ω<sub>V1</sub> = {GOTI_2018_OMEGA.V1},
          ω<sub>Q</sub> = {GOTI_2018_OMEGA.Q}, ω<sub>V2</sub> = {GOTI_2018_OMEGA.V2}).
        </li>
        <li>
          Apply a fixed regimen (15 mg/kg q12h, 1.5 h infusion, rounded to nearest 250 mg,
          capped 500–3000 mg) and simulate steady-state concentrations from the patient&rsquo;s
          Goti truth.
        </li>
        <li>
          Sample a <strong>peak (~1.5 h post-infusion-end after dose 4)</strong> and a{" "}
          <strong>trough (~0.5 h before dose 5)</strong>. Add combined residual error:
          proportional {(GOTI_2018_RESIDUAL.proportional * 100).toFixed(0)}% CV +
          additive {GOTI_2018_RESIDUAL.additive_mg_l.toFixed(1)} mg/L SD.
        </li>
        <li>
          Feed the two noisy levels into Vancomyzer&rsquo;s a posteriori Bayesian engine
          (which uses the <strong>Colin 2019 prior — NOT Goti</strong>).
          The engine recovers a posterior {`{`}CL, V<sub>1</sub>, Q, V<sub>2</sub>{`}`}.
        </li>
        <li>
          Predict the concentration at a <strong>held-out timepoint</strong> (trough
          0.5 h before the next dose) from Vancomyzer&rsquo;s posterior. Compare to the
          patient&rsquo;s Goti truth at that same timepoint.
        </li>
        <li>
          Aggregate predicted–vs–observed pairs across the cohort. Compute the Sheiner–Beal
          relative bias (accuracy) and relative root-mean-squared error (precision).
        </li>
      </ol>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 14, marginBottom: 0 }}>
        The analysis is fully reproducible: the same fixed patient set produces the same results every time.
      </p>
    </section>
  );
}

function LimitationsCard() {
  const limits: { label: string; body: string }[] = [
    {
      label: "Synthetic ≠ real",
      body: "Goti+BSV truth captures population-level PK variability but not unmodeled ICU physiology — fluid shifts in sepsis, drug-drug interactions, third spacing, hypoalbuminemia, or assay-batch noise. Real-world rRMSE will be higher; the Bai 2025 27.69–37.64% range is the realistic target.",
    },
    {
      label: "Best-case sampling protocol",
      body: "We give the engine BOTH a peak and a trough at steady state — the highest-information protocol per ASHP/IDSA 2020. Real practice often has trough-only or a pre-steady-state level, which would degrade both rBias and rRMSE. The harness should be re-run with trough-only and pre-SS variants before any claim about robustness.",
    },
    {
      label: "Goti BSV values are literature-typical, not transcribed",
      body: "The raw OMEGA matrix from Goti 2018 isn't openly published. We used ω = 0.40 / 0.30 / 0.50 / 0.40 — within the range of published adult vancomycin popPK models. Tightening or widening BSV will move both metrics; the sensitivity has not been formally quantified.",
    },
    {
      label: "HD and ARC patients excluded",
      body: "Matches Bai's exclusion criteria and Vancomyzer's published scope. Continuous renal replacement, ECMO, and augmented renal clearance subpopulations are NOT covered by this validation. Performance there is unknown.",
    },
    {
      label: "Held-out point is one steady-state trough",
      body: "Predicting a peak from a peak+trough fit is mechanically easier than predicting a far-future concentration with covariate drift (changing SCr, weight). Multi-point and longitudinal validation is a future-work item.",
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Limitations</h2>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
        {limits.map((l, i) => (
          <li key={i} style={{ padding: "10px 12px", borderLeft: "3px solid #dc2626", background: "#fef2f2", marginBottom: 8, borderRadius: 3 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{l.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#7f1d1d", lineHeight: 1.55 }}>{l.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextStagesCard() {
  const stages = [
    {
      n: "Stage 1",
      status: "✓ Shipped (this page)",
      title: "Synthetic Goti-truth stress test",
      body: "Model-misspecification validation against published popPK truth, n=200, deterministic seed.",
    },
    {
      n: "Stage 2",
      status: "○ Planned",
      title: "Retrospective de-identified ICU cohort",
      body: "Partner with an academic medical center. Run Vancomyzer, Tucuxi (Colin + Goti + Thomson models), ideally PrecisePK on a real de-identified TDM dataset. Target journal: Therapeutic Drug Monitoring or Pharmacotherapy.",
    },
    {
      n: "Stage 3",
      status: "○ Planned",
      title: "Prospective ICU validation",
      body: "Multi-year program modeled on Ter Heine 2020 (InsightRX prospective validation, Dutch ICU). The bar for Hospital-tier credibility.",
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Validation roadmap</h2>
      <div style={{ marginTop: 12 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ padding: "12px 14px", background: i === 0 ? "#ecfdf5" : "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-dim)" }}>
              {s.n} · {s.status}
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
