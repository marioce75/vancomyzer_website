/**
 * /transparent-dosing/cases — Literature cases page.
 *
 * Lists every PublishedCase, runs each through the calculator when the page is
 * built, and shows the result in one of three forms:
 *   - same-model reproduction (Colin 2019): calculator vs published value with a
 *     pass/fail badge against the case's tolerance
 *   - cross-model reference: calculator (Colin 2019) next to a value from a
 *     different published model or a cohort statistic; difference shown for
 *     context, never pass/fail, excluded from the summary statistics
 *   - reference band: published multi-model comparison, no calculator run
 *
 * The same cases run in `npm test` (scripts/verify-cases.ts); a same-model
 * reproduction outside tolerance fails the suite.
 */

import Link from "next/link";
import { CASES } from "@/lib/validation/registry";
import { runAllCases, summarize, type CaseSummary } from "@/lib/validation/runCase";
import type { PublishedCase, CaseResult, ReferenceBand, ComparisonKind } from "@/lib/validation/types";
import { COLIN_2019 } from "@/lib/pk/modelRegistry";

export const metadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing/cases" },
  title: "Literature Reproducibility — Vancomyzer",
  description:
    "Vancomyzer's Colin 2019 equations checked against published values, plus published results from other models shown for context. " +
    "These cases run in the automated checks; a difference outside the stated tolerance fails the check.",
};

const CROSS_MODEL_WORDING = "Different model — difference shown for context, not a pass/fail test.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export default function CasesPage() {
  const results = runAllCases(CASES);
  const summary = summarize(results);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px 80px" }}>
      <Breadcrumb />

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6, lineHeight: 1.2 }}>
        Literature Reproducibility
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-secondary)", lineHeight: 1.55, marginTop: 0, marginBottom: 12, maxWidth: 720 }}>
        Published vancomycin values run through Vancomyzer&apos;s calculator. Cases that use the same model
        as the calculator ({COLIN_2019.shortName}) are pass/fail checks of the implementation. Cases from other
        published models or patient cohorts are shown for context only. These cases run in the automated
        checks; a difference outside the stated tolerance fails the check.
      </p>
      <p style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.55, marginTop: 0, marginBottom: 24, maxWidth: 720 }}>
        Vancomyzer has not yet been validated in real patients. Its equations are checked against published
        values and synthetic test cases; external validation with patient data is planned.
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
         Evidence
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
      <strong>No cases are registered yet.</strong> Each case will list the cited paper, the patient
      inputs, the published value and the calculator&apos;s output, with the difference shown in either
      direction.
    </div>
  );
}

interface BodyProps {
  cases: PublishedCase[];
  results: CaseResult[];
  summary: CaseSummary;
}

const GROUPS: { kind: ComparisonKind; title: string; intro: string }[] = [
  {
    kind: "same_model_reproduction",
    title: `Same-model reproductions (${COLIN_2019.shortName}) · pass/fail`,
    intro: `The published value comes from ${COLIN_2019.shortName}, the model the calculator uses, so the calculator should reproduce it within the stated tolerance.`,
  },
  {
    kind: "cross_model_reference",
    title: "Cross-model references · context only",
    intro: `The published value comes from a different model or summarizes a patient cohort. The calculator's ${COLIN_2019.shortName} value is shown next to it; these cards never pass or fail.`,
  },
  {
    kind: "reference_band",
    title: "Published reference band · no calculator run",
    intro: "Published results from a multi-model comparison, shown for context. Vancomyzer was not run on these patients.",
  },
];

function Body({ cases, results, summary }: BodyProps) {
  return (
    <>
      <SummaryScorecard summary={summary} />
      {GROUPS.map((g) => {
        const indices = cases.map((c, i) => (c.comparison_kind === g.kind ? i : -1)).filter((i) => i >= 0);
        if (indices.length === 0) return null;
        return (
          <section key={g.kind} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 4px" }}>
              {g.title}
            </h2>
            <p style={{ fontSize: 12, color: "var(--color-dim)", margin: "0 0 12px", lineHeight: 1.55 }}>{g.intro}</p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
              {indices.map((i) => (
                <CaseCard key={cases[i].id} caseDef={cases[i]} result={results[i]} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function SummaryScorecard({ summary }: { summary: CaseSummary }) {
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
          <div style={{ fontSize: 20, fontWeight: 700, color: allPassing ? "#047857" : "#92400e", marginTop: 4 }}>
            {summary.passing} / {summary.reproduction_count} same-model reproductions within tolerance
            {summary.failing > 0 && (
              <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 10, color: "#92400e" }}>
                · {summary.failing} outside tolerance
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 4 }}>
            Not pass/fail: {summary.cross_model_reference_count} cross-model reference
            {summary.cross_model_reference_count === 1 ? "" : "s"} and {summary.reference_band_count} reference band
            {summary.reference_band_count === 1 ? "" : "s"}, excluded from these statistics.
          </div>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 16px", margin: 0, fontSize: 12, color: "var(--color-secondary)" }}>
          <dt style={{ margin: 0 }}>Largest |AUC₂₄ difference|</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{summary.max_abs_auc_pct == null ? "—" : `${summary.max_abs_auc_pct.toFixed(2)}%`}</dd>
          <dt style={{ margin: 0 }}>Largest |CL difference|</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{summary.max_abs_clearance_pct == null ? "—" : `${summary.max_abs_clearance_pct.toFixed(2)}%`}</dd>
        </dl>
      </div>
    </div>
  );
}

function CaseCard({ caseDef, result }: { caseDef: PublishedCase; result: CaseResult }) {
  if (caseDef.comparison_kind === "reference_band" && caseDef.reference_band) {
    return <ReferenceBandCard caseDef={caseDef} band={caseDef.reference_band} />;
  }
  const isReproduction = caseDef.comparison_kind === "same_model_reproduction";
  const pass = result.status === "pass";
  const borderColor = isReproduction ? (pass ? "#10b981" : "#f59e0b") : "#64748b";
  return (
    <article
      id={caseDef.id}
      style={{
        padding: "16px 20px",
        background: "var(--color-card)",
        border: `1px solid ${isReproduction && !pass ? "#fcd34d" : "var(--color-border)"}`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 6,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 6 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", margin: 0 }}>
          {caseDef.source.specific_reference}
        </h3>
        {isReproduction ? <PassFailBadge pass={pass} failures={result.failures} /> : <ContextBadge />}
      </header>
      {!isReproduction && (
        <p style={{ fontSize: 12, fontWeight: 600, color: "#334155", margin: "0 0 6px 0" }}>{CROSS_MODEL_WORDING}</p>
      )}
      <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: "0 0 6px 0" }}>
        <strong>{isReproduction ? "What it tests:" : "What it shows:"}</strong> {caseDef.what_it_tests}
      </p>
      <p style={{ fontSize: 12, color: "var(--color-dim)", margin: "0 0 12px 0", lineHeight: 1.55 }}>
        {caseDef.notes_for_page}
      </p>

      <PatientRegimenLine caseDef={caseDef} />

      {isReproduction ? <ReproductionTable caseDef={caseDef} result={result} /> : <CrossModelTable caseDef={caseDef} result={result} />}

      {isReproduction && !pass && (
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
          <strong>Outside tolerance:</strong> {result.failures.join("; ")}. This case is shown so the page
          reflects the calculator&apos;s current behavior; the discrepancy needs investigation.
        </div>
      )}

      <SourceDetails caseDef={caseDef} />

      <footer style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href={caseDef.source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "var(--color-primary)", textDecoration: "underline" }}
        >
          {caseDef.source.citation}
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
          Run in calculator
        </Link>
      </footer>
    </article>
  );
}

function SourceDetails({ caseDef }: { caseDef: PublishedCase }) {
  return (
    <details style={{ marginTop: 10, fontSize: 12, color: "var(--color-secondary)" }}>
      <summary style={{ cursor: "pointer", color: "var(--color-dim)" }}>How the published value was obtained</summary>
      <div style={{ marginTop: 6, lineHeight: 1.55 }}>
        <p style={{ margin: "0 0 4px" }}><strong>Extraction:</strong> {caseDef.published.extraction_method}</p>
        <p style={{ margin: "0 0 4px" }}><strong>Verification:</strong> {caseDef.source.verification_note}</p>
        <p style={{ margin: 0 }}><strong>Tolerance:</strong> {caseDef.published.tolerance_rationale}</p>
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Reference-band card — published multi-model AUC comparison.
// Renders the per-model means as horizontal bars with optional SD
// whiskers, highlighting the model Vancomyzer uses for dosing.
// No calculator call, no pass/fail.
// ─────────────────────────────────────────────────────────────────────

function ReferenceBandCard({ caseDef, band }: { caseDef: PublishedCase; band: ReferenceBand }) {
  // Pad ±10% beyond the min/max of (mean ± SD) so the whiskers don't clip.
  const lows = band.platforms.map((p) => p.mean_auc24_mg_h_l - (p.sd_auc24_mg_h_l ?? 0));
  const highs = band.platforms.map((p) => p.mean_auc24_mg_h_l + (p.sd_auc24_mg_h_l ?? 0));
  const rawMin = Math.min(...lows);
  const rawMax = Math.max(...highs);
  const span = rawMax - rawMin;
  const xMin = Math.max(0, Math.floor((rawMin - span * 0.1) / 100) * 100);
  const xMax = Math.ceil((rawMax + span * 0.1) / 100) * 100;
  const xRange = xMax - xMin;

  return (
    <article
      id={caseDef.id}
      style={{
        padding: "16px 20px",
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderLeft: "4px solid #6366f1",
        borderRadius: 6,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 6 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", margin: 0 }}>
          {caseDef.source.specific_reference}
        </h3>
        <span style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe", borderRadius: 4 }}>
          ◇ Reference band · not pass/fail
        </span>
      </header>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: "0 0 6px 0" }}>
        <strong>What it shows:</strong> {caseDef.what_it_tests}
      </p>
      <p style={{ fontSize: 12, color: "var(--color-dim)", margin: "0 0 10px 0", lineHeight: 1.55 }}>
        {caseDef.notes_for_page}
      </p>

      <div style={{ fontSize: 11, color: "var(--color-dim)", lineHeight: 1.55, padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 12 }}>
        <strong style={{ color: "var(--color-primary)" }}>Cohort:</strong> {band.cohort_description}
      </div>

      <div style={{ marginBottom: 12, overflowX: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-dim)", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Published cohort-mean AUC₂₄ (mg·h/L) per population model
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 200px) minmax(80px, 1fr) 90px", gap: 8, alignItems: "center", fontSize: 12 }}>
          {band.platforms.map((p) => {
            const barWidthPct = ((p.mean_auc24_mg_h_l - xMin) / xRange) * 100;
            const whiskerLow = p.sd_auc24_mg_h_l != null ? Math.max(0, ((p.mean_auc24_mg_h_l - p.sd_auc24_mg_h_l - xMin) / xRange) * 100) : null;
            const whiskerHigh = p.sd_auc24_mg_h_l != null ? Math.min(100, ((p.mean_auc24_mg_h_l + p.sd_auc24_mg_h_l - xMin) / xRange) * 100) : null;
            return (
              <PlatformRow
                key={p.name}
                name={p.name}
                notes={p.notes}
                mean={p.mean_auc24_mg_h_l}
                sd={p.sd_auc24_mg_h_l}
                barWidthPct={barWidthPct}
                whiskerLowPct={whiskerLow}
                whiskerHighPct={whiskerHigh}
                highlight={p.is_vancomyzer_prior === true}
              />
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 200px) minmax(80px, 1fr) 90px", gap: 8, marginTop: 4, fontSize: 10, color: "var(--color-dim)" }}>
          <div></div>
          <div style={{ position: "relative", height: 14 }}>
            <span style={{ position: "absolute", left: "0%" }}>{xMin}</span>
            <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>{Math.round((xMin + xMax) / 2)}</span>
            <span style={{ position: "absolute", left: "100%", transform: "translateX(-100%)" }}>{xMax}</span>
          </div>
          <div></div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--color-secondary)", padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 10, lineHeight: 1.55 }}>
        <strong style={{ color: "var(--color-primary)" }}>How this relates to Vancomyzer:</strong> {band.our_position}
      </div>

      <footer style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href={caseDef.source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "var(--color-primary)", textDecoration: "underline" }}
        >
          {caseDef.source.citation}
        </a>
        <span style={{ fontSize: 11, color: "var(--color-dim)" }}>
          DOI: {caseDef.source.doi}
        </span>
      </footer>
    </article>
  );
}

function PlatformRow({
  name, notes, mean, sd, barWidthPct, whiskerLowPct, whiskerHighPct, highlight,
}: {
  name: string;
  notes?: string;
  mean: number;
  sd?: number;
  barWidthPct: number;
  whiskerLowPct: number | null;
  whiskerHighPct: number | null;
  highlight: boolean;
}) {
  const barColor = highlight ? "#6366f1" : "#94a3b8";
  return (
    <>
      <div style={{ color: highlight ? "var(--color-primary)" : "var(--color-secondary)", fontWeight: highlight ? 600 : 400, lineHeight: 1.3 }}>
        {name}
        {notes && (
          <div style={{ fontSize: 10, color: highlight ? "#3730a3" : "var(--color-dim)", fontWeight: 500, marginTop: 1 }}>
            {notes}
          </div>
        )}
      </div>
      <div style={{ position: "relative", height: 24, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 3 }}>
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 0,
            height: 16,
            width: `${barWidthPct}%`,
            background: barColor,
            borderRadius: 2,
          }}
        />
        {whiskerLowPct != null && whiskerHighPct != null && (
          <>
            <div
              style={{
                position: "absolute",
                top: 11,
                left: `${whiskerLowPct}%`,
                width: `${whiskerHighPct - whiskerLowPct}%`,
                height: 2,
                background: "#0f172a",
                opacity: 0.5,
              }}
            />
            <div style={{ position: "absolute", top: 6, left: `${whiskerLowPct}%`, width: 1, height: 12, background: "#0f172a", opacity: 0.5 }} />
            <div style={{ position: "absolute", top: 6, left: `${whiskerHighPct}%`, width: 1, height: 12, background: "#0f172a", opacity: 0.5 }} />
          </>
        )}
      </div>
      <div style={{ fontSize: 12, color: highlight ? "var(--color-primary)" : "var(--color-secondary)", fontWeight: highlight ? 700 : 500, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
        {mean.toFixed(0)}
        {sd != null && <span style={{ color: "var(--color-dim)", fontWeight: 400 }}> ± {sd.toFixed(0)}</span>}
      </div>
    </>
  );
}

function PassFailBadge({ pass, failures }: { pass: boolean; failures: string[] }) {
  if (pass) {
    return (
      <span style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", borderRadius: 4 }}>
        Within tolerance
      </span>
    );
  }
  return (
    <span
      title={failures.join("; ")}
      style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4 }}
    >
      ⚠ Outside tolerance
    </span>
  );
}

function ContextBadge() {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4 }}>
      Different model · context only
    </span>
  );
}

const INPUTS_LABEL: Record<PublishedCase["patient"]["inputs_status"], string> = {
  published: "Inputs as published",
  approximated: "Inputs partly approximated (not verified)",
  illustrative: "Illustrative inputs (not from the source)",
  not_applicable: "Not applicable",
};

function PatientRegimenLine({ caseDef }: { caseDef: PublishedCase }) {
  const p = caseDef.patient;
  const r = caseDef.regimen;
  return (
    <div style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 10, lineHeight: 1.55 }}>
      <div>
        <strong style={{ color: "var(--color-primary)" }}>Patient:</strong>{" "}
        {p.age_years} y {p.sex} · {p.weight_kg} kg · SCr {p.serum_creatinine_mg_dl} mg/dL
        {p.height_cm && <> · {p.height_cm} cm</>}
        {r && (
          <>
            <span style={{ margin: "0 8px", color: "var(--color-border)" }}>·</span>
            <strong style={{ color: "var(--color-primary)" }}>Regimen:</strong>{" "}
            {r.dose_mg} mg every {r.interval_hours} h over {r.infusion_duration_hours} h
          </>
        )}
        {caseDef.levels.length > 0 && (
          <>
            <span style={{ margin: "0 8px", color: "var(--color-border)" }}>·</span>
            <strong style={{ color: "var(--color-primary)" }}>Levels (hours after the start of the dose):</strong>{" "}
            {caseDef.levels.map((l, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {l.value_mcg_ml} mg/L at {l.time_since_last_dose_hours} h
              </span>
            ))}
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-dim)", marginTop: 4 }}>
        <strong>{INPUTS_LABEL[p.inputs_status]}.</strong> {p.notes}
      </div>
    </div>
  );
}

interface MetricRow {
  label: string;
  published: number | null;
  publishedText?: string;
  engine: number | null;
  pct: number | null;
  digits: number;
  tol?: number;
}

function metricRows(caseDef: PublishedCase, result: CaseResult): MetricRow[] {
  const pub = caseDef.published;
  const tol = caseDef.tolerance;
  const range = pub.auc24_range;
  const rows: MetricRow[] = [
    {
      label: "AUC₂₄ (mg·h/L)",
      published: pub.auc24_mg_h_l,
      publishedText:
        pub.auc24_mg_h_l != null && range
          ? `${pub.auc24_mg_h_l.toFixed(1)} (${range.low}–${range.high})`
          : undefined,
      engine: result.predicted.auc24,
      pct: result.deltas.auc24_pct,
      digits: 1,
      tol: tol?.auc24_pct,
    },
    { label: "CL (L/h)", published: pub.clearance_l_h, engine: result.predicted.clearance_l_h, pct: result.deltas.clearance_pct, digits: 2, tol: tol?.clearance_pct },
    { label: "V₁ (L)", published: pub.v1_l, engine: result.predicted.v1_l, pct: result.deltas.v1_pct, digits: 1, tol: tol?.v1_pct },
    { label: "Peak (mg/L)", published: pub.peak_mcg_ml, engine: result.predicted.peak, pct: result.deltas.peak_pct, digits: 1, tol: tol?.peak_pct },
    { label: "Trough (mg/L)", published: pub.trough_mcg_ml, engine: result.predicted.trough, pct: result.deltas.trough_pct, digits: 1, tol: tol?.trough_pct },
  ];
  return rows.filter((r) => r.published != null);
}

function signedPct(v: number | null, digits: number): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
}

function ReproductionTable({ caseDef, result }: { caseDef: PublishedCase; result: CaseResult }) {
  const rows = metricRows(caseDef, result);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            <th style={thStyle}></th>
            <th style={thStyle}>Published</th>
            <th style={thStyle}>Vancomyzer ({COLIN_2019.shortName})</th>
            <th style={thStyle}>Difference</th>
            <th style={thStyle}>Tolerance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ok = r.pct != null && r.tol != null && Math.abs(r.pct) <= r.tol;
            return (
              <tr key={r.label} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={tdLabelStyle}>{r.label}</td>
                <td style={tdNumStyle}>{r.publishedText ?? r.published?.toFixed(r.digits) ?? "—"}</td>
                <td style={tdNumStyle}>{r.engine?.toFixed(r.digits) ?? "—"}</td>
                <td style={{ ...tdNumStyle, color: ok ? "#047857" : "#b91c1c", fontWeight: 600 }}>
                  {signedPct(r.pct, 2)} {ok ? "Within tolerance" : "Outside tolerance"}
                </td>
                <td style={tdNumStyle}>±{r.tol}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CrossModelTable({ caseDef, result }: { caseDef: PublishedCase; result: CaseResult }) {
  const rows = metricRows(caseDef, result);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            <th style={thStyle}></th>
            <th style={thStyle}>Published (different model or cohort)</th>
            <th style={thStyle}>Vancomyzer ({COLIN_2019.shortName})</th>
            <th style={thStyle}>Difference (context only)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={tdLabelStyle}>{r.label}</td>
              <td style={tdNumStyle}>{r.publishedText ?? r.published?.toFixed(r.digits) ?? "—"}</td>
              <td style={tdNumStyle}>{r.engine?.toFixed(r.digits) ?? "—"}</td>
              <td style={{ ...tdNumStyle, color: "var(--color-secondary)" }}>{signedPct(r.pct, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {caseDef.published.auc24_range && (
        <p style={{ fontSize: 11, color: "var(--color-dim)", margin: "6px 0 0", lineHeight: 1.5 }}>
          AUC₂₄ values in parentheses: {caseDef.published.auc24_range.description}.
        </p>
      )}
    </div>
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
  whiteSpace: "nowrap",
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
        Limitations
      </h2>
      <ul style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.65, marginLeft: 18, marginTop: 0, marginBottom: 0 }}>
        <li>
          These cases check the calculator against published values; they are not clinical validation.
          Vancomyzer has not yet been validated in real patients. Its equations are checked against
          published values and synthetic test cases; external validation with patient data is planned.
        </li>
        <li>
          Only the same-model reproductions ({COLIN_2019.shortName}) are pass/fail tests. They use
          model-typical individuals rather than real patients, so they confirm that the equations are
          implemented as published, not that doses are accurate for patients.
        </li>
        <li>
          Cross-model references compare the calculator ({COLIN_2019.shortName}) with a different published
          model or a cohort statistic. {CROSS_MODEL_WORDING} A difference does not show which model is more
          accurate for a given patient. Some of these cards use approximated or illustrative inputs; each
          card says which.
        </li>
        <li>
          <strong>No pediatric, dialysis or post-transplant cases.</strong> These are outside
          Vancomyzer&apos;s scope (adults not on renal replacement therapy).
        </li>
        <li>
          <strong>Sources considered but not added as cases:</strong>
          {" "}Rybak/ASHP 2020 (narrative recommendations only, no worked patient example to reproduce);
          {" "}Pai 2014 (aggregate results across the cohort, no per-patient demographics with AUC);
          {" "}Turner 2018 (aggregate medians and interquartile ranges per program across 19 ICU patients;
          not yet added as a reference band);
          {" "}Neely 2014 cohort trough (the comparison was circular: the fitted level was the value being
          compared);
          {" "}Shingde 2020 single-sample Bayesian (the candidate &quot;published AUC&quot; was derived
          rather than read from the paper, so the comparison would have been circular).
          {" "}Patanwala 2022 is shown above as a reference band.
        </li>
        <li>
          A &quot;within tolerance&quot; result does not mean a recommendation is correct for any
          individual patient. Every clinical decision remains the responsibility of the treating clinician.
        </li>
        <li>
          These cases run in the automated checks; a difference outside the stated tolerance fails the check.
          A case outside tolerance is still shown on this page, with an amber badge.
        </li>
      </ul>
    </section>
  );
}
