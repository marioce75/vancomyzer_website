/**
 * /transparent-dosing/cases — Literature Reproducibility page.
 *
 * Lists every PublishedCase, runs each through the engine at render
 * time, and shows the delta between our prediction and the published
 * value. Cards are color-coded:
 *   - within tolerance → green check
 *   - drifted beyond tolerance → amber warning + transparent explanation
 *
 * Build-time enforcement: scripts/verify-cases.ts (wired into `npm test
 * via test:cases`) hard-fails the build if ANY case drifts beyond its
 * declared tolerance — so this page can never silently regress in prod.
 *
 * Empty-state: if CASES is empty (pre-curation), shows a placeholder
 * explaining the page is under construction. Honest, not aspirational.
 */

import Link from "next/link";
import { CASES } from "@/lib/validation/registry";
import { runAllCases, summarize } from "@/lib/validation/runCase";
import type { PublishedCase, CaseResult } from "@/lib/validation/types";

export const metadata = {
  title: "Literature Reproducibility — Vancomyzer",
  description:
    "Every Vancomyzer release is tested against published vancomycin cases. " +
    "If our calculator drifts from the literature, the build fails before it ships.",
};

export default function CasesPage() {
  const results = runAllCases(CASES);
  const summary = summarize(results);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Literature Reproducibility
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 720 }}>
        Every Vancomyzer release runs through a library of published vancomycin cases.
        If our calculator drifts from the cited literature beyond a pre-declared tolerance,
        the build fails before it ships. The result is on this page — auditable, deterministic,
        and refreshed on every deploy.
      </p>

      {CASES.length === 0 ? <EmptyState /> : <Body cases={CASES} results={results} summary={summary} />}

      <Limitations />
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
      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Literature Reproducibility</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "20px 22px",
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        color: "#78350f",
        borderRadius: 6,
        fontSize: 14,
        lineHeight: 1.55,
        marginBottom: 28,
      }}
    >
      <strong>Case library under curation.</strong> The first 8 published cases are being
      verified against their primary sources. Each case will list the cited paper, the
      patient inputs, the published prediction, and our calculator&apos;s live output —
      with a delta in either direction shown transparently.
    </div>
  );
}

interface BodyProps {
  cases: PublishedCase[];
  results: CaseResult[];
  summary: ReturnType<typeof summarize>;
}

function Body({ cases, results, summary }: BodyProps) {
  return (
    <>
      <SummaryScorecard summary={summary} />
      <div style={{ display: "grid", gap: 16, marginBottom: 28 }}>
        {cases.map((c, i) => (
          <CaseCard key={c.id} caseDef={c} result={results[i]} />
        ))}
      </div>
    </>
  );
}

function SummaryScorecard({ summary }: { summary: ReturnType<typeof summarize> }) {
  const allPassing = summary.failing === 0;
  return (
    <div
      style={{
        padding: "16px 20px",
        marginBottom: 24,
        background: allPassing ? "#ecfdf5" : "#fffbeb",
        border: `1px solid ${allPassing ? "#6ee7b7" : "#fcd34d"}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Summary
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: allPassing ? "#047857" : "#92400e", marginTop: 4 }}>
            {summary.passing} / {summary.total} cases within tolerance
            {summary.failing > 0 && (
              <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 10, color: "#92400e" }}>
                · {summary.failing} drifted
              </span>
            )}
          </div>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 16px", margin: 0, fontSize: 12, color: "var(--color-secondary)" }}>
          <dt style={{ margin: 0 }}>Median |AUC₂₄ error|</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{summary.median_abs_auc_pct?.toFixed(1) ?? "—"}%</dd>
          <dt style={{ margin: 0 }}>Max |AUC₂₄ error|</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{summary.max_abs_auc_pct?.toFixed(1) ?? "—"}%</dd>
        </dl>
      </div>
    </div>
  );
}

function CaseCard({ caseDef, result }: { caseDef: PublishedCase; result: CaseResult }) {
  const pass = result.within_tolerance;
  return (
    <article
      id={caseDef.id}
      style={{
        padding: "16px 20px",
        background: "var(--color-card)",
        border: `1px solid ${pass ? "var(--color-border)" : "#fcd34d"}`,
        borderLeft: `4px solid ${pass ? "#10b981" : "#f59e0b"}`,
        borderRadius: 6,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", margin: 0 }}>
          {caseDef.source.specific_reference}
        </h2>
        <PassFailBadge pass={pass} failures={result.failures} />
      </header>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: "0 0 6px 0" }}>
        <strong>What it tests:</strong> {caseDef.what_it_tests}
      </p>
      <p style={{ fontSize: 12, color: "var(--color-dim)", margin: "0 0 12px 0", lineHeight: 1.55 }}>
        {caseDef.notes_for_page}
      </p>

      <PatientRegimenLine caseDef={caseDef} />

      <DeltaTable caseDef={caseDef} result={result} />

      {!pass && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 4,
            fontSize: 12,
            color: "#78350f",
          }}
        >
          <strong>Drift exceeded tolerance:</strong> {result.failures.join("; ")}.
          We show this case anyway so the page reflects honest engine behavior, not
          a curated success story.
        </div>
      )}

      <footer style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href={caseDef.source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "var(--color-primary)", textDecoration: "underline" }}
        >
          {caseDef.source.citation} ↗
        </a>
        <span style={{ fontSize: 11, color: "var(--color-dim)" }}>
          DOI: {caseDef.source.doi}
        </span>
        {!caseDef.source.verified && (
          <span style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", padding: "1px 8px", borderRadius: 3 }}>
            secondary source
          </span>
        )}
        <Link
          href={`/calculator?case=${caseDef.id}`}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            background: "var(--color-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            textDecoration: "none",
          }}
        >
          Run in calculator →
        </Link>
      </footer>
    </article>
  );
}

function PassFailBadge({ pass, failures }: { pass: boolean; failures: string[] }) {
  if (pass) {
    return (
      <span style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", borderRadius: 4 }}>
        ✓ Within tolerance
      </span>
    );
  }
  return (
    <span
      title={failures.join("; ")}
      style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4 }}
    >
      ⚠ Drifted
    </span>
  );
}

function PatientRegimenLine({ caseDef }: { caseDef: PublishedCase }) {
  const p = caseDef.patient;
  const r = caseDef.regimen;
  return (
    <div style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 10, lineHeight: 1.55 }}>
      <strong style={{ color: "var(--color-primary)" }}>Patient:</strong>{" "}
      {p.age_years}y {p.sex} · {p.weight_kg} kg · SCr {p.serum_creatinine_mg_dl} mg/dL
      {p.height_cm && <> · {p.height_cm} cm</>}
      {r && (
        <>
          <span style={{ margin: "0 8px", color: "var(--color-border)" }}>·</span>
          <strong style={{ color: "var(--color-primary)" }}>Regimen:</strong>{" "}
          {r.dose_mg} mg q{r.interval_hours}h × {r.doses_given} dose{r.doses_given === 1 ? "" : "s"}
        </>
      )}
      {caseDef.levels.length > 0 && (
        <>
          <span style={{ margin: "0 8px", color: "var(--color-border)" }}>·</span>
          <strong style={{ color: "var(--color-primary)" }}>Levels:</strong>{" "}
          {caseDef.levels.map((l, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {l.value_mcg_ml} mcg/mL @ {l.time_since_last_dose_hours}h
            </span>
          ))}
        </>
      )}
    </div>
  );
}

function DeltaTable({ caseDef, result }: { caseDef: PublishedCase; result: CaseResult }) {
  const rows: { label: string; published: number | null; predicted: number | null; pct: number | null; tol: number }[] = [
    { label: "AUC₂₄ (mg·h/L)", published: caseDef.published.auc24_mg_h_l, predicted: result.predicted.auc24, pct: result.deltas.auc24_pct, tol: caseDef.tolerance.auc24_pct },
    { label: "Peak (mcg/mL)", published: caseDef.published.peak_mcg_ml, predicted: result.predicted.peak, pct: result.deltas.peak_pct, tol: caseDef.tolerance.peak_pct },
    { label: "Trough (mcg/mL)", published: caseDef.published.trough_mcg_ml, predicted: result.predicted.trough, pct: result.deltas.trough_pct, tol: caseDef.tolerance.trough_pct },
  ].filter((r) => r.published != null);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
          <th style={thStyle}></th>
          <th style={thStyle}>Published</th>
          <th style={thStyle}>Vancomyzer</th>
          <th style={thStyle}>Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const ok = r.pct == null || Math.abs(r.pct) <= r.tol;
          return (
            <tr key={r.label} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={tdLabelStyle}>{r.label}</td>
              <td style={tdNumStyle}>{r.published?.toFixed(1) ?? "—"}</td>
              <td style={tdNumStyle}>{r.predicted?.toFixed(1) ?? "—"}</td>
              <td style={{ ...tdNumStyle, color: ok ? "#047857" : "#b91c1c", fontWeight: 600 }}>
                {r.pct == null ? "—" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}% ${ok ? "✓" : "⚠"}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "right",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--color-dim)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const tdLabelStyle: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  color: "var(--color-secondary)",
};
const tdNumStyle: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-primary)",
};

function Limitations() {
  return (
    <section
      style={{
        marginTop: 28,
        padding: "16px 20px",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
      }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 0, marginBottom: 10 }}>
        Honest limitations
      </h2>
      <ul style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.65, marginLeft: 18, marginTop: 0, marginBottom: 0 }}>
        <li>
          These are <strong>reproducibility tests against published model
          parameters</strong>, not real-world clinical validation. Most popPK
          papers don&apos;t publish per-patient individual cases with full
          demographics + dose + AUC — they publish covariate equations and
          population-typical predictions. So these cases test &quot;does our engine
          reproduce the cited model&apos;s typical-individual output?&quot;, not
          &quot;does our engine match a published real patient&apos;s observed AUC?&quot;.
        </li>
        <li>
          Cases drawn from our derivation papers (Colin 2019) confirm
          implementation correctness — by construction the typical-individual
          output should match within a few percent.
        </li>
        <li>
          The Smit 2020 case is published with a <strong>by-design drift</strong>:
          our Vancomyzer Obesity Model composes Smit + Zhang 2024 + Janmahasatian
          FFM and produces a higher CL (~25% lower AUC) than pure Smit at 130 kg.
          We show that drift transparently rather than tuning the test until it
          looks clean.
        </li>
        <li>
          <strong>No pediatric, dialysis, or post-transplant cases</strong> in this
          set. The platform&apos;s prior is an adult population model; we don&apos;t
          attempt to validate scenarios outside its derivation cohort.
        </li>
        <li>
          <strong>Cases we attempted but could not verify:</strong> Colin 2019
          renal-impairment subset (paywalled covariate Table); Rybak/ASHP 2020
          Appendix A worked example (paywalled at AJHP); Pai 2014 MIPD case
          (paywalled, abstract is methodological); Drennan 2024 trough-only
          Bayesian (no such paper exists in PubMed). These are documented openly
          here rather than fabricated.
        </li>
        <li>
          A &quot;within tolerance&quot; result does not mean the recommendation
          is correct for any individual patient. Every clinical recommendation
          remains the responsibility of the licensed clinician at the bedside.
        </li>
        <li>
          When a case shows drift beyond its tolerance, we display it anyway with
          an amber badge and explanation. The page is intended to surface honest
          engine behavior, not to be a curated success story. The build itself
          hard-fails on undocumented drift, which is why this page is up to date
          on every deploy.
        </li>
      </ul>
    </section>
  );
}
