/**
 * /transparent-dosing/software-checks — developer-run checks of the
 * calculator's arithmetic (independent reference calculation), its loading-dose
 * handling and its 90% credible band.
 *
 * The band-coverage table is read from the results file written by
 * scripts/verify-band-coverage.ts, so the page cannot drift from the last run.
 * The reference-calculation counts come from src/lib/pk/__tests__/oracle and
 * are restated here with the calculator version they were run on; re-run
 * `npm run test:oracle` and update CHECKS_RUN_ON when the engine changes.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { MODEL_MANIFEST_VERSION, COLIN_2019 } from "@/lib/pk/modelRegistry";
import { RERUN_2026 } from "@/lib/validation/engineCrosscheck2026";
import coverage from "@/lib/validation/bandCoverage/band-coverage-results.json";
import { PageHeader, Record, H3, Prose, Chip, INK, INK2, INK3 } from "@/components/site/Record";

export const metadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing/software-checks" },
  title: "Software checks — Vancomyzer™",
  description:
    "Developer-run checks of Vancomyzer's arithmetic against an independent reference calculation, its loading-dose handling, and the coverage of its 90% credible band in synthetic patients.",
};

/** Calculator version the reference-calculation and loading-dose results below were run on. */
const CHECKS_RUN_ON = "2026-09-25.1";

const ORACLE_SECTIONS = [
  { id: "A", what: "The reference implementation against matrix-exponential solutions computed separately in Python (SciPy), for single doses, dose trains and steady state.", n: "71 checks" },
  { id: "B", what: "Published reference values for a typical adult (35 y, 70 kg, SCr 0.83 mg/dL; 1,000 mg q12h over 1.75 h).", n: "6 checks" },
  { id: "C", what: "Mathematical properties the solution must satisfy, such as mass balance, superposition and the steady-state limit.", n: "171 checks" },
  { id: "D", what: "The calculator's own code against the reference: the Colin 2019 prior, the reference regimen, every fixture case (including slow elimination, q18h/q36h and 0.5–4 h infusions), 20 random adult regimens and the analytic AUC.", n: "6 groups" },
  { id: "E", what: "The loading-dose history against the reference: 40 random schedules (loading dose, infusion times, a shortened gap to the first maintenance dose, 2–7 doses), comparing concentrations, AUC, the dose-N trough and AUC, and the fit's predicted level.", n: "40 regimens" },
];

const LOADING_BIAS = [
  { load: "2,000 mg", after: "Dose 2", ignored: "+27%", entered: "0%" },
  { load: "2,000 mg", after: "Dose 3", ignored: "+16%", entered: "0%" },
  { load: "2,000 mg", after: "Dose 5", ignored: "+7%", entered: "0%" },
  { load: "2,500 mg", after: "Dose 2", ignored: "+39%", entered: "0%" },
  { load: "2,500 mg", after: "Dose 3", ignored: "+23%", entered: "0%" },
];

type Cell = {
  scenario: string; design: string; n_patients: number; n_band: number; n_unavailable: number;
  pooled_coverage: number; pooled_coverage_se: number; pooled_below: number; pooled_above: number;
  last_trough_coverage: number; last_peak_coverage: number;
};

const DESIGN_LABEL: { [design: string]: string } = {
  empiric: "No levels",
  one_level: "One level after dose 5",
  peak_trough: "Peak and trough at steady state",
  loading_dose: "Loading dose, one level after dose 3",
};
const DESIGN_ORDER = ["empiric", "one_level", "loading_dose", "peak_trough"];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function coverageRows(scenario: string): Cell[] {
  return DESIGN_ORDER.map((d) => (coverage.cells as Cell[]).find((c) => c.scenario === scenario && c.design === d)).filter(Boolean) as Cell[];
}

function CoverageTable({ scenario }: { scenario: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="vz-ledger">
        <thead>
          <tr>
            <th scope="col">Levels entered</th>
            <th scope="col">Band shown</th>
            <th scope="col">Coverage (target 90%)</th>
            <th scope="col">Below / above band</th>
            <th scope="col">At last trough</th>
            <th scope="col">At last peak</th>
          </tr>
        </thead>
        <tbody>
          {coverageRows(scenario).map((c) => (
            <tr key={c.design}>
              <td>{DESIGN_LABEL[c.design] ?? c.design}</td>
              <td className="whitespace-nowrap" style={{ color: INK2 }}>{c.n_band} of {c.n_patients}</td>
              <td><strong>{pct(c.pooled_coverage)}</strong> <span style={{ color: INK3 }}>(±{(1.96 * c.pooled_coverage_se * 100).toFixed(1)})</span></td>
              <td style={{ color: INK2 }}>{pct(c.pooled_below)} / {pct(c.pooled_above)}</td>
              <td style={{ color: INK2 }}>{pct(c.last_trough_coverage)}</td>
              <td style={{ color: INK2 }}>{pct(c.last_peak_coverage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SoftwareChecksPage() {
  const splitIiv = (coverage.cells as Cell[]).find((c) => c.scenario === "published_iiv" && c.design === "peak_trough");
  const splitErr = (coverage.cells as Cell[]).find((c) => c.scenario === "published_error" && c.design === "peak_trough");
  const versionsMatch = coverage.engine_manifest === MODEL_MANIFEST_VERSION && CHECKS_RUN_ON === MODEL_MANIFEST_VERSION;
  return (
    <div style={{ color: INK }}>
      <PageHeader
        compact
        kicker="Evidence and methods"
        title="Software checks"
        lede={
          <>
            Three developer-run checks: the calculator&rsquo;s arithmetic against an independently written reference
            calculation, its handling of a loading dose, and how often its 90% band contains the true concentration
            in synthetic patients. They test whether the software does what it describes. They do not show how
            accurately it predicts levels in real patients.
          </>
        }
      >
        <p className="mt-4 text-[14px]" style={{ color: INK3 }}>
          Calculator version <code>{MODEL_MANIFEST_VERSION}</code>.{" "}
          {versionsMatch
            ? "All results on this page were run on this version."
            : `Results were run on version ${CHECKS_RUN_ON} (reference calculation) and ${coverage.engine_manifest} (band coverage); re-run pending.`}
        </p>
      </PageHeader>

      {/* ── REFERENCE CALCULATION ─────────────────────────── */}
      <Record id="reference" label="Independent reference calculation" note="Does the code compute what the equations say?">
        <div className="mb-3"><Chip kind="ok">Developer-run · 255 passed, 0 failed</Chip></div>
        <Prose>
          <p>
            A second implementation of the two-compartment equations was written from the differential equations,
            without importing any calculator code. It is first checked against solutions computed separately in
            Python, then the calculator&rsquo;s own functions are compared with it. Agreement must be within one part in
            a million wherever both sides are exact.
          </p>
        </Prose>
        <div className="mt-4 overflow-x-auto">
          <table className="vz-ledger">
            <thead><tr><th scope="col">Section</th><th scope="col">What is compared</th><th scope="col">Size</th></tr></thead>
            <tbody>
              {ORACLE_SECTIONS.map((s) => (
                <tr key={s.id}><td className="whitespace-nowrap font-semibold">{s.id}</td><td style={{ color: INK2 }}>{s.what}</td><td className="whitespace-nowrap" style={{ color: INK2 }}>{s.n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose className="mt-4">
          <p>
            Result on version {CHECKS_RUN_ON}: 255 checks passed and no value differed from the reference by more than
            one part in a million. The same developer wrote both implementations, so a shared misreading of the
            model would not be caught; the <Link href="/transparent-dosing/engine-crosscheck" style={{ textDecoration: "underline" }}>comparison with Tucuxi</Link> uses
            a separately built program for that reason.
            {RERUN_2026.allFitsSucceeded && RERUN_2026.maxRelDiffPct === 0 && (
              <> Its Vancomyzer side was re-run on version {RERUN_2026.version} and reproduces the published comparison exactly.</>
            )}
          </p>
        </Prose>
      </Record>

      {/* ── LOADING DOSE ──────────────────────────────────── */}
      <Record id="loading-dose" label="Loading-dose handling" note="Levels drawn after a loading dose.">
        <div className="mb-3"><Chip kind="ok">Developer-run · synthetic</Chip></div>
        <Prose>
          <p>
            In the 1- and 2-level workflows, dose 1 can be entered as a loading dose with its own amount, infusion time
            and gap to the first maintenance dose. The fit to the measured levels then uses the doses actually given.
            If a loading dose is recorded as a maintenance dose instead, the extra drug is read as slow clearance and
            exposure is overestimated.
          </p>
          <p>
            Example: a 60-year-old, 80 kg adult (SCr 1.0 mg/dL) on 1,000 mg every 12 h over 2 h, with one trough
            11.5 h after the stated dose. Error in the calculated steady-state AUC₂₄ against the true value:
          </p>
        </Prose>
        <div className="mt-4 overflow-x-auto">
          <table className="vz-ledger">
            <thead><tr><th scope="col">Loading dose</th><th scope="col">Level after</th><th scope="col">Loading dose not entered</th><th scope="col">Loading dose entered</th></tr></thead>
            <tbody>
              {LOADING_BIAS.map((r, i) => (
                <tr key={i}><td>{r.load}</td><td style={{ color: INK2 }}>{r.after}</td><td style={{ color: "#a32d2d" }}>{r.ignored}</td><td><strong>{r.entered}</strong></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose className="mt-4">
          <p>
            This patient matches the population model exactly, so entering the loading dose recovers the true value.
            In patients who differ from the model, one level still leaves the estimate pulled toward the population
            model; the automated tests check that entering the loading dose gives the same accuracy as for the same
            patient without one, and that leaving it out adds a consistent overestimate. A loading dose equal to the
            maintenance dose reproduces the equal-dose result exactly. Held, missed or changed maintenance doses are
            still refused rather than guessed.
          </p>
        </Prose>
      </Record>

      {/* ── BAND COVERAGE ─────────────────────────────────── */}
      <Record id="band" label="Uncertainty band coverage" note="Does the 90% band contain the truth 90% of the time?">
        <div className="mb-3"><Chip kind="warn">Developer-run · synthetic · not yet validated in patients</Chip></div>
        <Prose>
          <p>
            {coverage.n_per_cell} synthetic adults per row, each given a true set of PK parameters. Levels were simulated
            from that truth with assay error and entered into the calculator the way a clinician would. Coverage is the
            share of plotted time points at which the true concentration lies inside the band (± 95% interval,
            accounting for repeated points in the same patient). Run on version {coverage.engine_manifest},{" "}
            {coverage.generated}.
          </p>
        </Prose>

        <div className="mt-8"><H3>When patients match the calculator&rsquo;s assumptions</H3></div>
        <Prose className="mt-2"><p>Tests the machinery. Every row should be close to 90%.</p></Prose>
        <CoverageTable scenario="app" />

        <div className="mt-8"><H3>When patients follow {COLIN_2019.shortName}&rsquo;s published variability</H3></div>
        <Prose className="mt-2">
          <p>
            A stress test: the published between-patient variability (CV 27.9% CL, 27.3% V1, 97.9% V2) and 21.5%
            residual error, while the calculator keeps its own settings.
          </p>
        </Prose>
        <CoverageTable scenario="published" />

        <Prose className="mt-5">
          <p>
            <strong>Reading.</strong> Under its own assumptions the band is calibrated. Before any level it is somewhat
            wide if the published variability is right. With a peak and a trough it is too narrow, mainly because the
            fit assumes a 15% assay error where the published model reports 21.5%
            {splitIiv && splitErr && (
              <> (the error-model difference alone gives {pct(splitErr.pooled_coverage)}; the variability difference alone {pct(splitIiv.pooled_coverage)})</>
            )}
            . This is why the chart labels the band &ldquo;model-based; not yet validated&rdquo;. Only measured patient
            levels can show which assumptions hold; coverage of a held-out level is a pre-specified endpoint of the
            planned validation study.
          </p>
        </Prose>
      </Record>

      {/* ── LIMITS ───────────────────────────────────────── */}
      <Record label="What these checks do not show" note="Read with the evidence page.">
        <Prose>
          <p>
            All three are written and run by the developer. None uses patient data, and none shows that{" "}
            {COLIN_2019.shortName} describes a particular population. See{" "}
            <Link href="/transparent-dosing" style={{ textDecoration: "underline" }}>Evidence and methods</Link> for the
            full list of checks and the pending independent clinical validation.
          </p>
        </Prose>
      </Record>
    </div>
  );
}
