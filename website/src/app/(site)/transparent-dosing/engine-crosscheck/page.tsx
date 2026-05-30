/**
 * /transparent-dosing/engine-crosscheck — Independent Engine Cross-Check (Part A).
 *
 * Renders the n=200 cross-check between Vancomyzer's TypeScript Bayesian
 * engine and Tucuxi (independent open-source C++ MIPD engine). ALL numbers
 * come from the imported engine-crosscheck-report.json — the verbatim run
 * artifact — so nothing is transcribed by hand.
 *
 * Unlike the Predictive Performance page (which recomputes live every
 * build via `npm run test:predictive`), this is a FIXED SNAPSHOT: Part A
 * depends on a locally-built Tucuxi C++ binary that isn't in the repo or on
 * the deploy host. The page states this explicitly.
 *
 * Honest scope (stated on the page): validates the ENGINE given a shared
 * model encoding we authored; does NOT independently validate the Colin
 * transcription. Prior injected; data synthetic.
 */

import Link from "next/link";
import {
  CROSSCHECK,
  CROSSCHECK_META,
  PARAM_ORDER,
  PARAM_LABEL,
} from "@/lib/validation/engineCrosscheck";

export const metadata = {
  title: "Independent Engine Cross-Check — Vancomyzer",
  description:
    "Vancomyzer's Bayesian engine cross-checked against Tucuxi, an independent " +
    "open-source C++ MIPD engine. Given identical priors and data, the two " +
    "engines agree on posterior PK parameters to under 1% (median, n=200).",
};

export default function EngineCrosscheckPage() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Independent Engine Cross-Check
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 760 }}>
        A second, independently-written pharmacokinetic engine should reach the
        same answer ours does. We checked: given identical priors and identical
        measured levels, does Vancomyzer&rsquo;s TypeScript Bayesian engine reach
        the same posterior PK parameters as <strong>Tucuxi</strong> — an
        open-source C++ model-informed precision dosing engine from a different
        team, in a different language? Across {CROSSCHECK.n} synthetic patients,
        the two engines agree to <strong>under 1% (median)</strong> on every
        parameter.
      </p>

      <SnapshotCaveat />
      <ResultCard />
      <AccuracyCard />
      <OutlierCard />
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

function SnapshotCaveat() {
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
      <strong>This is a fixed snapshot, not a live computation.</strong> The
      sister <Link href="/transparent-dosing/predictive-performance" style={{ color: "#2563eb", fontWeight: 600 }}>Predictive
      Performance</Link> page recomputes on every deploy. This one can&rsquo;t:
      it requires a locally-compiled build of the Tucuxi C++ engine, which
      isn&rsquo;t in our repo or on the server. The figures below are the verbatim
      output of a single run (seed {CROSSCHECK_META.seed}, {CROSSCHECK.n} patients,
      {" "}{CROSSCHECK_META.date}) and the page renders directly from that run&rsquo;s
      saved data file — nothing is retyped.
    </div>
  );
}

function ResultCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Engine-to-engine agreement · n = {CROSSCHECK.n}</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Relative difference between the two engines&rsquo; posterior estimates
        (vs the mean of the two), per PK parameter. Both engines were given the
        <em> same </em> population prior and the <em>same</em> two measured levels.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-dim)" }}>
              <th style={cellStyle}>Parameter</th>
              <th style={numCellStyle}>median |Δ|</th>
              <th style={numCellStyle}>mean signed</th>
              <th style={numCellStyle}>p90 |Δ|</th>
              <th style={numCellStyle}>p95 |Δ|</th>
              <th style={numCellStyle}>max |Δ|</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_ORDER.map((k, i) => {
              const s = CROSSCHECK.summary[k];
              return (
                <tr key={k} style={{ borderBottom: i < PARAM_ORDER.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                  <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{PARAM_LABEL[k]}</td>
                  <td style={{ ...numCellStyle, fontWeight: 700, color: "#047857" }}>{s.median_abs.toFixed(2)}%</td>
                  <td style={numCellStyle}>{s.mean_signed >= 0 ? "+" : ""}{s.mean_signed.toFixed(2)}%</td>
                  <td style={numCellStyle}>{s.p90_abs.toFixed(2)}%</td>
                  <td style={numCellStyle}>{s.p95_abs.toFixed(2)}%</td>
                  <td style={numCellStyle}>{s.max_abs.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        All four parameters agree to <strong>under 1% at the median</strong>, with
        negligible systematic offset (largest is CL at +{CROSSCHECK.summary.CL.mean_signed.toFixed(2)}%).
        The wider individual maxima come from a handful of augmented-renal-clearance
        patients — see below.
      </p>
    </section>
  );
}

function AccuracyCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Accuracy vs the known synthetic truth</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        Because the patients are simulated, the &ldquo;true&rdquo; PK is known.
        Median absolute error of each engine&rsquo;s posterior against that truth,
        with the unfitted prior shown for reference (lower is better).
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
            {PARAM_ORDER.map((k, i) => {
              const a = CROSSCHECK.accuracy_vs_truth[k];
              return (
                <tr key={k} style={{ borderBottom: i < PARAM_ORDER.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                  <td style={{ ...cellStyle, color: "var(--color-primary)", fontWeight: 600 }}>{PARAM_LABEL[k]}</td>
                  <td style={{ ...numCellStyle, color: "var(--color-dim)" }}>{a.prior.toFixed(1)}%</td>
                  <td style={{ ...numCellStyle, fontWeight: 700 }}>{a.vz.toFixed(1)}%</td>
                  <td style={{ ...numCellStyle, fontWeight: 700 }}>{a.tucuxi.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
        The two engines are <strong>statistically interchangeable</strong> — within
        0.1–0.4 points of each other on every parameter. An honest nuance: only
        <strong> clearance</strong> is materially improved by a two-level fit
        ({CROSSCHECK.accuracy_vs_truth.CL.prior.toFixed(1)}% → ~{CROSSCHECK.accuracy_vs_truth.CL.vz.toFixed(1)}%).
        The inter-compartmental and peripheral-volume terms (Q, V₂) are barely
        moved — a peak-plus-trough at steady state simply doesn&rsquo;t constrain
        them, so both engines correctly leave them near the prior. That the two
        independent engines behave <em>identically</em> on the under-constrained
        parameters is itself corroboration, not a defect.
      </p>
    </section>
  );
}

function OutlierCard() {
  const cl = CROSSCHECK.outliers.CL.slice(0, 3);
  const v1 = CROSSCHECK.outliers.V1.slice(0, 3);
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Where the engines diverge most</h2>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
        The largest disagreements cluster at creatinine-clearance extremes, where
        the steady-state trough falls toward assay noise and two levels
        under-constrain the fit. Top three per parameter (patient id, CrCl, Δ):
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <OutlierMini title="Clearance (CL)" rows={cl} />
        <OutlierMini title="Central volume (V₁)" rows={v1} />
      </div>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
        The single largest divergence on both parameters is the same patient
        ({cl[0].id}, CrCl {cl[0].crcl.toFixed(0)} mL/min — augmented renal
        clearance). This is expected for sparse-data Bayesian estimation; it
        affects only the distribution tail, not the median.
      </p>
    </section>
  );
}

function OutlierMini({ title, rows }: { title: string; rows: typeof CROSSCHECK.outliers.CL }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-dim)" }}>{title}</p>
      {rows.map((o) => (
        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", fontFamily: "var(--font-mono, monospace)" }}>
          <span style={{ color: "var(--color-secondary)" }}>{o.id} · CrCl {o.crcl.toFixed(0)}</span>
          <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{o.delta_pct >= 0 ? "+" : ""}{o.delta_pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function MethodologyCard() {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Methodology</h2>
      <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.65, color: "var(--color-secondary)" }}>
        <li>
          Generate <strong>{CROSSCHECK.n}</strong> synthetic ICU patients (seed
          {" "}{CROSSCHECK_META.seed}, the same generator as the Predictive
          Performance page), with &ldquo;true&rdquo; PK drawn from the Goti-2018
          population model.
        </li>
        <li>
          Simulate a steady-state peak and trough for each patient, with
          realistic assay noise.
        </li>
        <li>
          Compute Vancomyzer&rsquo;s per-patient Colin-2019 prior, then run our
          Bayesian engine on the two levels → posterior {`{`}CL, V₁, Q, V₂{`}`}.
        </li>
        <li>
          Build a Tucuxi drug-model file ({CROSSCHECK_META.structuralModel}) with
          the <strong>same prior injected</strong> as fixed values and matched
          variability + residual-error terms, plus a query carrying the
          <strong> same dose history and the same two levels</strong>. Run
          {" "}<code>tucucli</code> a-posteriori → Tucuxi&rsquo;s posterior.
        </li>
        <li>
          Compare the two posteriors per parameter. An analyzer asserts every one
          of the {CROSSCHECK.n} patients is accounted for and refuses to summarize
          if any run is dropped.
        </li>
      </ol>
      <p style={{ fontSize: 12, color: "var(--color-dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}>
        Comparator: {CROSSCHECK_META.comparator} ·{" "}
        <a href={`https://${CROSSCHECK_META.comparatorRepo}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>
          {CROSSCHECK_META.comparatorRepo} ↗
        </a>{" "}
        · commit {CROSSCHECK_META.comparatorCommit} · AGPL-3.0. Tucuxi is developed
        by the REDS institute at HEIG-VD (Yann Thoma).
      </p>
    </section>
  );
}

function ScopeCard() {
  const limits = [
    {
      label: "Validates the engine, not our Colin transcription",
      body: "No canonical Colin-2019 vancomycin model file is published in Tucuxi's open repositories (it ships only with their desktop app). We authored the model file used here. So this confirms two independent engines converge given the same model encoding — it does not independently confirm our Colin equations. Those are checked separately on the Literature Reproducibility page.",
    },
    {
      label: "The prior is injected, not re-derived",
      body: "Both engines start from a byte-identical prior (Vancomyzer's, baked into the Tucuxi file). That's the point — it isolates the engine (optimizer + structural model + likelihood) as the only variable.",
    },
    {
      label: "Synthetic data",
      body: "Patients and levels are Monte-Carlo simulated. No patient data is involved. Real-world behavior is addressed separately by the Predictive Performance stress test.",
    },
    {
      label: "Two-sample design",
      body: "A peak + trough constrains clearance well but not the inter-compartmental/peripheral-volume terms. The agreement on CL/V₁ is the load-bearing result; Q/V₂ agreement reflects both engines staying near the shared prior.",
    },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Scope &amp; honest limitations</h2>
      <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
        {limits.map((l, i) => (
          <li key={i} style={{ padding: "10px 12px", borderLeft: "3px solid #d97706", background: "#fffbeb", marginBottom: 8, borderRadius: 3 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>{l.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>{l.body}</p>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
        <strong>What this establishes:</strong> an independent open-source C++
        Bayesian dosing engine, given identical priors and data, reproduces
        Vancomyzer&rsquo;s posterior clearance and volume estimates to within ~1%
        (median, n={CROSSCHECK.n}) and matches its accuracy against a known truth
        to within 0.4 points. Vancomyzer&rsquo;s optimizer and two-compartment math
        are corroborated by an independent implementation.
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
