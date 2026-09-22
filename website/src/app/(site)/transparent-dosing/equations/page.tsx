import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { isOpenAccess } from "@/lib/openAccess";
import {
  COLIN_2019,
  COLIN_2019_PARAMETERS,
  COLIN_2021_OBESE_EVALUATION,
  HIGH_BMI_THRESHOLD_KG_M2,
  MODEL_MANIFEST_VERSION,
  highBmiAdvisory,
} from "@/lib/pk/modelRegistry";

export const metadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing/equations" },
  title: "Equations & Derivations — Vancomyzer™",
  description:
    `Full mathematical derivations for Vancomyzer's two-compartment PK model — the ${COLIN_2019.shortName} population model, two-compartment rate constants, single-dose and multi-dose superposition, steady-state AUC₂₄, and body-weight scaling. Open math; cite if useful.`,
  openGraph: {
    title: "Equations & Derivations — Vancomyzer™",
    description: "The math behind every Vancomyzer dose recommendation, in the open.",
    type: "article",
    url: "https://vancomyzer.com/transparent-dosing/equations",
    siteName: "Vancomyzer™",
  },
};

/* ── Values rendered from the model registry ───────────────────
 * Model names, citations, parameter values, equation strings and model
 * status come from src/lib/pk/modelRegistry.ts, the same registry that
 * supplies the engine's parameters, so this page cannot drift from the math. */

const P = COLIN_2019_PARAMETERS;

const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
const doiUrl = (doi: string) => `https://doi.org/${doi}`;
const COLIN_2021_PMID = COLIN_2021_OBESE_EVALUATION.citation.match(/PMID:\s*(\d+)/)?.[1];
const VARIABILITY = COLIN_2019.publishedVariability;
const REFERENCE = COLIN_2019.referenceCheck;

const COLIN_MODEL_BLOCK = [
  ...Object.values(COLIN_2019.equations),
  "",
  `Typical values (${COLIN_2019.shortName}, Table 3):`,
  `  θCL   = ${P.thetaCL} L/h per 70 kg`,
  `  θV1   = ${P.thetaV1} L per 70 kg`,
  `  θV2   = ${P.thetaV2} L per 70 kg`,
  `  θQ    = ${P.thetaQ} L/h per 70 kg`,
  `  PMA50 = ${P.pma50Weeks} weeks (maturation half-point)`,
  `  γ1    = ${P.hillMaturation} (maturation Hill coefficient)`,
  `  AGE50 = ${P.age50DeclineYears} years (PMA at which ageing halves CL)`,
  `  γ2    = ${P.hillDecline} (age-decline Hill coefficient)`,
  `  θSCR  = ${P.thetaSCr} per mg/dL`,
  "",
  `Typical-adult reference check (${REFERENCE.input}):`,
  `  CL ≈ ${REFERENCE.expectedCL_L_h.toFixed(2)} L/h   V1 = ${REFERENCE.expectedV1_L} L   V2 = ${REFERENCE.expectedV2_L} L   Q = ${REFERENCE.expectedQ_L_h} L/h`,
].join("\n");

const INFORMATIONAL_FORMULAS = [
  "Fat-free mass (Janmahasatian 2005):",
  "  Male:    FFM = (9270 × TBW) / (6680 + 216 × BMI)",
  "  Female:  FFM = (9270 × TBW) / (8780 + 244 × BMI)",
  "",
  "Cockcroft-Gault CrCl, on TBW, adjusted body weight or FFM:",
  "  CrCl  = ((140 − age) × weight) / (72 × SCr)   [× 0.85 if female]",
  "  IBW   = 50 kg (male) or 45.5 kg (female) + 2.3 kg per inch over 60 in",
  "  AdjBW = IBW + 0.4 × (TBW − IBW)",
].join("\n");


const HIGH_BMI_EXAMPLE = highBmiAdvisory({ weight_kg: 130, height_cm: 175 });
const HEIGHT_MISSING_EXAMPLE = highBmiAdvisory({ weight_kg: 130, height_cm: null });

const PRE_STYLE: CSSProperties = {
  background: "#ffffff",
  color: "#14232f",
  fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
  lineHeight: 1.7,
  border: "1px solid #cbd6e0",
  borderRadius: 0,
};

const WRAPPED_PRE_STYLE: CSSProperties = { ...PRE_STYLE, whiteSpace: "pre-wrap" };

export default function EquationsPage() {
  return (
    <main style={{ color: "#14232f" }}>
      {/* ── HEADER ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-4 sm:px-6" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="py-10 md:py-12">
          <Link href="/transparent-dosing" className="text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#546471" }}>
            Evidence
          </Link>
          <h1 className="vz-serif mt-3 max-w-[24ch] text-[clamp(28px,3.4vw,40px)] leading-[1.08]" style={{ color: "#14232f" }}>
            Equations &amp; derivations
          </h1>
          <p className="mt-[18px] max-w-[62ch] text-lg leading-[1.5]" style={{ color: "#4a5a68" }}>
            Every equation, constant and reference the calculator uses, so the method can be reviewed
            and the calculations checked against the cited sources.
          </p>
          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed" style={{ color: "#546471" }}>
            Model names, citations and equations on this page use the same reference values as
            the calculator (calculator version{" "}
            <span style={{ color: "#14232f", fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}>
              {MODEL_MANIFEST_VERSION}
            </span>
            ).
          </p>
        </div>
      </section>

      {/* ── SECTION 1: COLIN 2019 MODEL (from the model registry) ─────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            1. Population model — {COLIN_2019.shortName}
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            Every adult is dosed with the {COLIN_2019.displayName}. Clearance is built from four covariate
            functions composed multiplicatively: allometric size scaling, sigmoidal maturation (effectively 1.0 for
            adults), an age-decline sigmoid, and a serum-creatinine exponential effect.
          </p>

          <dl className="mt-4 max-w-3xl space-y-2 text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
            <div>
              <dt className="inline font-semibold" style={{ color: "#14232f" }}>Structure: </dt>
              <dd className="inline">{COLIN_2019.structure}</dd>
            </div>
            <div>
              <dt className="inline font-semibold" style={{ color: "#14232f" }}>Source data: </dt>
              <dd className="inline">{COLIN_2019.sourcePopulation}</dd>
            </div>
            <div>
              <dt className="inline font-semibold" style={{ color: "#14232f" }}>Scope in Vancomyzer: </dt>
              <dd className="inline">{COLIN_2019.vancomyzerScope}</dd>
            </div>
            <div>
              <dt className="inline font-semibold" style={{ color: "#14232f" }}>Renal covariate: </dt>
              <dd className="inline">{COLIN_2019.renalCovariate}</dd>
            </div>
          </dl>

          <pre
            className="mt-6 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{COLIN_MODEL_BLOCK}</pre>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "#14232f" }}>
                Published covariates not applied
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
                {COLIN_2019.omittedCovariates.map((covariate) => (
                  <li key={covariate}>{covariate}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: "#14232f" }}>
                Published variability
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
                Between-subject variability (CV): CL {pct(VARIABILITY.iivCvCL)}, V1 {pct(VARIABILITY.iivCvV1)}, V2{" "}
                {pct(VARIABILITY.iivCvV2)}; proportional residual error {pct(VARIABILITY.residualProportional)}. Shown
                for reference only: the Bayesian fit uses Vancomyzer&rsquo;s own prior widths (section 7).
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs" style={{ color: "#546471" }}>
            {COLIN_2019.citation}&nbsp;
            <a href={doiUrl(COLIN_2019.doi)} target="_blank" rel="noopener noreferrer" style={{ color: "#1f5e96" }}>
              doi:{COLIN_2019.doi}
            </a>
          </p>
        </div>
      </section>

      {/* ── SECTION 2: TWO-COMPARTMENT RATE CONSTANTS ──────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            2. Two-compartment rate constants
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            Vancomycin behaves as a two-compartment drug: a central compartment (V₁) that contains the
            measured concentration, and a peripheral compartment (V₂) the drug distributes into and
            slowly returns from. The hybrid rate constants α (fast, distribution) and β (slow, terminal
            elimination) are the eigenvalues of the system.
          </p>

          <pre
            className="mt-6 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{`k10 = CL / V1
k12 = Q / V1
k21 = Q / V2

α + β = k10 + k12 + k21
α × β = k10 × k21

α = ½ [(k10 + k12 + k21) + √((k10 + k12 + k21)² − 4·k10·k21)]
β = ½ [(k10 + k12 + k21) − √((k10 + k12 + k21)² − 4·k10·k21)]

A = (α − k21) / [V1 × (α − β)]
B = (k21 − β) / [V1 × (α − β)]

Half-lives:
  t½α = ln(2) / α     distribution half-life (~0.5–4h)
  t½β = ln(2) / β     terminal elimination half-life (~6–80h)`}</pre>
        </div>
      </section>

      {/* ── SECTION 3: SINGLE-DOSE IV INFUSION ─────────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            3. Single-dose concentration (IV infusion)
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            Closed-form solution for a constant-rate IV infusion of duration T_inf. During infusion the
            concentration builds; after the pump stops, it falls as a sum of two exponentials.
          </p>

          <pre
            className="mt-6 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{`R0 = dose_mg / T_inf            (infusion rate, mg/h)

During infusion (0 ≤ t ≤ T_inf):
  C(t) = R0 × [ A/α × (1 − e^(−α·t))
              + B/β × (1 − e^(−β·t)) ]

After infusion (t > T_inf):
  C(t) = R0 × [ A/α × (1 − e^(−α·T_inf)) × e^(−α·(t − T_inf))
              + B/β × (1 − e^(−β·T_inf)) × e^(−β·(t − T_inf)) ]`}</pre>
        </div>
      </section>

      {/* ── SECTION 4: MULTI-DOSE SUPERPOSITION ────────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            4. Multi-dose superposition (accumulation to steady state)
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            For repeated dosing the total concentration at any time is the linear sum of single-dose
            contributions from every prior dose. The number of doses simulated is chosen so the curve
            spans at least 5 terminal half-lives (about 97% of steady state).
          </p>

          <pre
            className="mt-6 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{`C_total(t) = Σ C_single(t − k·τ)   for k = 0, 1, 2, …, N−1
             where t ≥ k·τ

Number of doses simulated:
  t½β  = ln(2) / β
  N    = max(10, ceil(5 × t½β / τ) + 2)

This ensures the graph spans enough time for concentrations
to approach steady state.`}</pre>
        </div>
      </section>

      {/* ── SECTION 5: STEADY-STATE AUC ────────────────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            5. Steady-state AUC₂₄
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            By linear pharmacokinetics, the steady-state daily exposure depends only on the daily dose
            and the patient&rsquo;s clearance — independent of how the dose is split across the day.
          </p>

          <pre
            className="mt-6 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{`AUC₂₄ = (dose_mg / CL) × (24 / τ)

Equivalently:
  AUC₂₄ = TDD / CL    (TDD = total daily dose)

This is exact under linear PK; peak and trough use the
two-compartment steady-state superposition formula
(not the multi-dose simulation) for maximum numerical accuracy.`}</pre>
        </div>
      </section>

      {/* ── SECTION 6: BODY SIZE — NO MODEL SWITCH ─────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            6. Body size: no model switch
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            {COLIN_2019.shortName} is used for every adult at every body size, including BMI{" "}
            {HIGH_BMI_THRESHOLD_KG_M2} kg/m² and above. Clearance and volumes scale with total body weight exactly as
            in section 1: CL and Q with (WT/70)<sup>0.75</sup>, V1 and V2 with WT/70. There is no BMI threshold at
            which a different model or different equations are used.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            At BMI {HIGH_BMI_THRESHOLD_KG_M2} kg/m² or more, the calculator adds an advisory because published
            evaluation of this model at that body size is limited. This is the advisory the calculator shows; for a patient weighing 130 kg with a height of 175 cm it reads:
          </p>
          {HIGH_BMI_EXAMPLE && (
            <blockquote
              className="mt-4 max-w-3xl border-l-[3px] px-5 py-3 text-sm leading-relaxed"
              style={{ borderColor: "#f59e0b", background: "#fffbeb", color: "#78350f" }}
            >
              {HIGH_BMI_EXAMPLE}
            </blockquote>
          )}
          {HEIGHT_MISSING_EXAMPLE && (
            <>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
                If height is not entered for a heavier patient, it reads:
              </p>
              <blockquote
                className="mt-2 max-w-3xl border-l-[3px] px-5 py-3 text-sm leading-relaxed"
                style={{ borderColor: "#f59e0b", background: "#fffbeb", color: "#78350f" }}
              >
                {HEIGHT_MISSING_EXAMPLE}
              </blockquote>
            </>
          )}

          <h3 className="mt-10 text-lg font-bold" style={{ color: "#14232f" }}>
            Shown for information only
          </h3>
          <p className="mt-2 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            At BMI {HIGH_BMI_THRESHOLD_KG_M2} kg/m² or more, the calculator also displays fat-free mass and alternative
            creatinine-clearance estimates so they can be compared with your own assessment. They use the formulas
            below and do not change the {COLIN_2019.shortName} calculation.
          </p>
          <pre
            className="mt-4 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{INFORMATIONAL_FORMULAS}</pre>
          <p className="mt-4 text-xs" style={{ color: "#546471" }}>
            Janmahasatian S, et al. <em>Clin Pharmacokinet</em>. 2005;44(10):1051–1065.&nbsp;
            <a href="https://doi.org/10.2165/00003088-200544100-00004" target="_blank" rel="noopener noreferrer" style={{ color: "#1f5e96" }}>
              doi:10.2165/00003088-200544100-00004
            </a>
            &nbsp;·&nbsp;
            Cockcroft DW, Gault MH. <em>Nephron</em>. 1976;16(1):31–41.&nbsp;
            <a href="https://pubmed.ncbi.nlm.nih.gov/1244564/" target="_blank" rel="noopener noreferrer" style={{ color: "#1f5e96" }}>
              PubMed
            </a>
          </p>

          <div className="mt-10 max-w-3xl border-l-[3px] px-5 py-4" style={{ borderColor: "#1f5e96", background: "#ffffff", outline: "1px solid #cbd6e0" }}>
            <p className="text-sm font-semibold" style={{ color: "#14232f" }}>
              Evidence for {COLIN_2019.shortName} in obesity
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
              {COLIN_2021_OBESE_EVALUATION.summary}
            </p>
            <p className="mt-2 text-xs" style={{ color: "#546471" }}>
              {COLIN_2021_OBESE_EVALUATION.citation}
              {COLIN_2021_PMID && (
                <>
                  &nbsp;
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${COLIN_2021_PMID}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1f5e96" }}
                  >
                    PubMed
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: BAYESIAN POSTERIOR ──────────────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            7. MAP-Bayesian posterior fitting
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            Given measured levels, Vancomyzer fits the patient&rsquo;s individual PK using maximum a
            posteriori (MAP) Bayesian estimation. It balances two things: how well the estimate fits the
            patient&rsquo;s measured concentrations (under a normal assay-error model), against how far it
            strays from the population priors (a log-normal prior on each PK parameter). The fit is
            repeated from several starting points and the lowest-objective result is kept, which makes it less
            likely that the optimizer stops at a poor local solution.
          </p>

          <pre
            className="mt-6 overflow-x-auto p-5 text-xs leading-relaxed sm:text-sm"
            style={PRE_STYLE} tabIndex={0}
          >{`minimize  Σᵢ ½·((Cᵢ_obs − Cᵢ_pred) / σᵢ)² + ln(σᵢ)
        + ½·(ln(CL/CL_prior) / ω_CL)²
        + ½·(ln(V1/V1_prior) / ω_V1)²
        + ½·(ln(Q /Q_prior ) / ω_Q )²
        + ½·(ln(V2/V2_prior) / ω_V2)²

Assay error model:
  σᵢ = max(1.0 mg/L, 0.15 × max(Cᵢ_obs, Cᵢ_pred))

Bounds: each fitted parameter is limited to between one-tenth and ten times its prior value.

Prior log-SDs (Vancomyzer settings, all adults):
  ω_CL = 0.35    ω_V1 = 0.25    ω_Q = 0.50    ω_V2 = 0.50`}</pre>

          <p className="mt-4 text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
            With MAP estimation, a single observation is weighed against the prior rather than replacing it. The
            prior widths above are Vancomyzer settings, not the published {COLIN_2019.shortName} variability shown
            in section 1. When the residual exceeds 25% relative error, the calculator surfaces a
            Fit Quality Advisory and recommends a confirmatory level rather than overriding the prior.
          </p>
        </div>
      </section>

      {/* ── SECTION 8: AUC TARGET ──────────────────────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14" style={{ borderBottom: "1px solid #cbd6e0" }}>
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            8. AUC₂₄ target — ASHP/IDSA/PIDS/SIDP 2020
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#4a5a68" }}>
            The therapeutic target of <strong>AUC₂₄ 400–600 mg·h/L</strong> (assuming MIC = 1 mg/L) follows
            the 2020 revised consensus guideline for serious MRSA infections. The guideline no longer recommends
            trough-only monitoring and recommends AUC-guided dosing, preferably with Bayesian estimation, citing data
            associating AUC-guided dosing with less acute kidney injury than trough-guided dosing. The calculator&rsquo;s
            recommendation search picks the dose × interval combination whose predicted steady-state AUC
            sits closest to the midpoint of this range.
          </p>
          <p className="mt-4 text-xs" style={{ color: "#546471" }}>
            Rybak MJ et al. <em>Am J Health Syst Pharm</em>. 2020;77(11):835–864.&nbsp;
            <a href="https://doi.org/10.1093/ajhp/zxaa036" target="_blank" rel="noopener noreferrer" style={{ color: "#1f5e96" }}>
              doi:10.1093/ajhp/zxaa036
            </a>
          </p>
        </div>
      </section>

      {/* ── FOUNDATIONAL TEXTS + DISCLAIMER ────────────────── */}
      <section className="px-4 py-12 sm:px-6 md:py-14">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="vz-serif text-[clamp(24px,2.6vw,32px)] leading-[1.15]" style={{ color: "#14232f" }}>
            Foundational texts
          </h2>
          <ul className="mt-4 max-w-[70ch] space-y-2 text-[15px] leading-relaxed" style={{ color: "#4a5a68" }}>
            <li>
              Rowland M, Tozer TN. <em>Clinical Pharmacokinetics and Pharmacodynamics: Concepts and Applications.</em> 4th ed. Lippincott Williams &amp; Wilkins; 2011.
            </li>
            <li>
              Gibaldi M, Perrier D. <em>Pharmacokinetics.</em> 2nd ed. Marcel Dekker; 1982.
            </li>
          </ul>

          <div className="mt-10 max-w-[70ch] border-l-[3px] bg-white px-5 py-4" style={{ borderColor: "#7a4e00", outline: "1px solid #cbd6e0" }}>
            <p className="text-sm font-semibold" style={{ color: "#14232f" }}>
              Decision support, not a substitute for judgment
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "#4a5a68" }}>
              These models, equations and references are published for transparency and audit. Vancomyzer&trade;
              is designed to meet the criteria for non-device clinical decision support in section 520(o)(1)(E) of
              the Federal Food, Drug, and Cosmetic Act (added by section 3060 of the 21st Century Cures Act). It has
              not been cleared, approved or otherwise reviewed by the FDA. It is intended for licensed healthcare
              professionals, who must independently review the basis for each recommendation. Vancomyzer has not
              yet been validated in real patients. Its equations are checked against published values and synthetic
              test cases; external validation with patient data is planned. See the full{" "}
              <a href="/disclaimer" style={{ color: "#1f5e96", textDecoration: "underline" }}>Medical Disclaimer</a>.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/transparent-dosing" className="vz-mbtn vz-mbtn--outline">
              Back to evidence
            </Link>
            <Link href={isOpenAccess() ? "/calculator" : "/register"} className="vz-mbtn vz-mbtn--primary">
              Open the calculator
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
