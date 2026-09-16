/**
 * /transparent-dosing/engine-crosscheck — Engine Cross-Check (Vancomyzer vs Tucuxi).
 *
 * A developer-run synthetic analysis (not real patients), run once on
 * 30 May 2026. ALL numbers come from the imported engine-crosscheck-report.json;
 * nothing is transcribed by hand.
 *
 * Scope (stated on the page): both programs were given the same priors and a
 * Colin model file written by Vancomyzer, so the comparison checks the fitting
 * implementation. It does not check the Colin 2019 equations or clinical
 * accuracy. No equivalence margins were prespecified; the page reports
 * observed agreement only.
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
import { COLIN_2019, VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED } from "@/lib/pk/modelRegistry";

export const metadata = {
  title: "Engine Cross-Check — Vancomyzer",
  description:
    "A developer-run synthetic analysis (not real patients): Vancomyzer's Bayesian fitting compared with Tucuxi " +
    "when both programs were given the same priors, the same model file and the same simulated levels (n=200, run 30 May 2026).",
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
  const s = CROSSCHECK.summary;
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Engine Cross-Check
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 12, maxWidth: 760 }}>
        A developer-run synthetic analysis (not real patients). Vancomyzer&rsquo;s Bayesian fitting was compared
        with <strong>Tucuxi</strong>, an open-source model-informed precision dosing program developed by the
        REDS institute at HEIG-VD, Switzerland. Both programs were given the same priors, a Colin model file
        written by Vancomyzer, the same dosing history and the same two simulated levels for {CROSSCHECK.n}{" "}
        synthetic patients. The median absolute difference between their clearance estimates was{" "}
        {s.CL.median_abs.toFixed(2)}% (95th percentile {s.CL.p95_abs.toFixed(2)}%, maximum{" "}
        {s.CL.max_abs.toFixed(2)}%).
      </p>
      <p style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 760 }}>
        Vancomyzer has not yet been validated in real patients. Its equations are checked against published
        values and synthetic test cases; external validation with patient data is planned.
      </p>

      <SnapshotNotice highBmiCount={audit.cohort_matches_report ? audit.high_bmi.length : null} />
      <ResultCard />
      <AccuracyCard />
      <OutlierCard audit={audit} />
      <MethodologyCard />
      <ScopeCard />
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
      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Engine Cross-Check</span>
    </div>
  );
}

function SnapshotNotice({ highBmiCount }: { highBmiCount: number | null }) {
  return (
    <div style={{
      padding: "14px 18px",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      borderLeft: "3px solid #2563eb",
      color: "#1e3a5f",
      borderRadius: 4,
      fontSize: 13,
      lineHeight: 1.55,
      marginBottom: 24,
    }}>
      <strong>Fixed snapshot from {CROSSCHECK_META.displayDate}.</strong> The developer ran this comparison once,
      with the {CROSSCHECK_META.engineVersion}. It has not been re-run since, and running Tucuxi requires a
      separate local installation, so it is not part of the site build. The figures below are read directly
      from that run&rsquo;s saved results.{" "}
      {highBmiCount == null ? (
        <>Whether any synthetic patient used the since-retired custom obesity model could not be confirmed.</>
      ) : (
        <>
          {highBmiCount} of the {CROSSCHECK.n} synthetic patients had a BMI of 40 or more with height and sex
          recorded, so on the run date Vancomyzer used its custom obesity model for them; that model was retired
          from dosing on {formatIsoDate(VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED.retiredOn)}. Current results could differ,
          particularly for those patients.
        </>
      )}
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
            {highBmiListed.map((p) => `${p.id} (BMI ${p.bmi.toFixed(1)})`).join(" and ")}. On the run date
            Vancomyzer used its since-retired custom obesity model for{" "}
            {highBmiListed.length === 1 ? "this patient" : "these patients"}. That model also used different prior variability from the single set of values documented for the
            Tucuxi model files, which may contribute to these differences; this was not recorded and has not been
            confirmed.
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
          Compute Vancomyzer&rsquo;s per-patient prior ({COLIN_2019.shortName} on the run date, or the since-retired
          custom obesity model for patients with a BMI of 40 or more), then run Vancomyzer&rsquo;s Bayesian fit on
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
      label: "Run date and engine version",
      body: `Run once on ${CROSSCHECK_META.displayDate} with the ${CROSSCHECK_META.engineVersion}. It has not been repeated with the current engine.`,
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
