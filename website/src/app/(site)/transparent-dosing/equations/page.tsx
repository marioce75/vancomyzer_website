import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Equations & Derivations — Vancomyzer™",
  description:
    "Full mathematical derivations for Vancomyzer's two-compartment PK engine — population CL, two-compartment rate constants, single-dose and multi-dose superposition, steady-state AUC₂₄. Open math; cite if useful.",
  openGraph: {
    title: "Equations & Derivations — Vancomyzer™",
    description: "The math behind every Vancomyzer dose recommendation, in the open.",
    type: "article",
    url: "https://vancomyzer.com/transparent-dosing/equations",
    siteName: "Vancomyzer™",
  },
};

export default function EquationsPage() {
  return (
    <main style={{ background: "#f8fafc", color: "#0f172a" }}>
      {/* ── HEADER ─────────────────────────────────────────── */}
      <section className="manifesto-dark px-6 py-16" style={{ background: "#0f172a" }}>
        <div className="mx-auto max-w-4xl">
          <Link
            href="/transparent-dosing"
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: "#00c9b1" }}
          >
            ← Back to the manifesto
          </Link>
          <h1
            className="mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl"
            style={{ color: "#ffffff" }}
          >
            Equations &amp; derivations
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed sm:text-lg" style={{ color: "#cbd5e1" }}>
            The full math behind every Vancomyzer recommendation. Same equations the engine evaluates,
            same constants, same references. Cite if useful, fork if you want to verify.
          </p>
        </div>
      </section>

      {/* ── SECTION 1: COLIN 2019 CL ───────────────────────── */}
      <section className="px-6 py-16" style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            1. Population clearance — Colin 2019
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            CL is built from four covariate functions composed multiplicatively: allometric size scaling,
            sigmoidal maturation (effectively 1.0 for adults), an age-decline sigmoid, and a serum-creatinine
            exponential effect.
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
          >{`CL (L/h) = θCL × FSize^0.75 × FMat × FDecline × FSCR

  FSize    = WT / 70
  FMat     = PMA(wk)^γ1 / (PMA(wk)^γ1 + PMA50^γ1)
  FDecline = 1 / (1 + (PMA(yr) / AGE50)^γ2)
  FSCR     = exp(-θSCR × (SCr − SCRstd))
  SCRstd   = exp(-1.228 + log10(PMA(yr)) × 0.672 + 6.27 × exp(-3.11 × PMA(yr)))

Constants (Table 3):
  θCL    = 5.31 L/h per 70 kg
  θSCR   = 0.649 (mg/dL scale)
  PMA50  = 46.4 weeks
  γ1     = 2.89
  AGE50  = 61.6 years     ← 50% CL reduction at this age
  γ2     = 2.24

Reference patient (35 yr, 70 kg, SCr 0.83) → CL 4.10 L/h ✓`}</pre>

          <p className="mt-4 text-xs" style={{ color: "#64748b" }}>
            Colin PJ et al. <em>Clin Pharmacokinet</em>. 2019;58(6):767–780.&nbsp;
            <a href="https://doi.org/10.1007/s40262-018-0727-5" target="_blank" rel="noopener noreferrer" style={{ color: "#00c9b1" }}>
              doi:10.1007/s40262-018-0727-5 ↗
            </a>
          </p>
        </div>
      </section>

      {/* ── SECTION 2: TWO-COMPARTMENT RATE CONSTANTS ──────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            2. Two-compartment rate constants
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            Vancomycin behaves as a two-compartment drug: a central compartment (V₁) that contains the
            measured concentration, and a peripheral compartment (V₂) the drug distributes into and
            slowly returns from. The hybrid rate constants α (fast, distribution) and β (slow, terminal
            elimination) are the eigenvalues of the system.
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
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
  t½α = ln(2) / α    ← distribution half-life (~0.5–4h)
  t½β = ln(2) / β    ← terminal elimination half-life (~6–80h)`}</pre>
        </div>
      </section>

      {/* ── SECTION 3: SINGLE-DOSE IV INFUSION ─────────────── */}
      <section className="px-6 py-16" style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            3. Single-dose concentration (IV infusion)
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            Closed-form solution for a constant-rate IV infusion of duration T_inf. During infusion the
            concentration builds; after the pump stops, it falls as a sum of two exponentials.
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
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
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            4. Multi-dose superposition (accumulation to steady state)
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            For repeated dosing the total concentration at any time is the linear sum of single-dose
            contributions from every prior dose. The number of doses simulated is chosen so the curve
            spans 4–5 terminal half-lives (95–97% of steady-state).
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
          >{`C_total(t) = Σ C_single(t − k·τ)   for k = 0, 1, 2, …, N−1
             where t ≥ k·τ

Number of doses simulated:
  t½β  = ln(2) / β
  N    = max(6, ceil(4 × t½β / τ) + 2)

This ensures the graph spans enough time for concentrations
to approach steady state.`}</pre>
        </div>
      </section>

      {/* ── SECTION 5: STEADY-STATE AUC ────────────────────── */}
      <section className="px-6 py-16" style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            5. Steady-state AUC₂₄
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            By linear pharmacokinetics, the steady-state daily exposure depends only on the daily dose
            and the patient&rsquo;s clearance — independent of how the dose is split across the day.
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
          >{`AUC₂₄ = (dose_mg / CL) × (24 / τ)

Equivalently:
  AUC₂₄ = TDD / CL    (TDD = total daily dose)

This is exact under linear PK; peak and trough use the
two-compartment steady-state superposition formula
(not the multi-dose simulation) for maximum numerical accuracy.`}</pre>
        </div>
      </section>

      {/* ── SECTION 6: OBESITY MODEL ───────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            6. Obesity model (BMI ≥ 40)
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            For patients with BMI ≥ 40, Vancomyzer activates a separate prior derived from morbid-obesity
            cohorts (Smit 2020 + Zhang 2024). Volumes scale to Fat-Free Mass (vancomycin is hydrophilic;
            it doesn&rsquo;t distribute into adipose), while clearance retains a TBW component because renal
            elimination scales with total body weight. Colin 2019&rsquo;s age-decline factor is composed on
            top — a small but defensible bridge of the geriatric-obesity gap that the source cohorts
            under-represented.
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
          >{`CL = (0.0571 × CrCl + 0.0158 × TBW) × FDecline(age)
V1 = 0.287 × FFM     (central volume — adipose excluded)
V2 = 0.89  × FFM     (peripheral volume — adipose excluded)
Q  = 1.23 L/h         (fixed intercompartmental clearance)

Fat-Free Mass (Janmahasatian 2005):
  Male:    FFM = (9270 × TBW) / (6680 + 216 × BMI)
  Female:  FFM = (9270 × TBW) / (8780 + 244 × BMI)

Cockcroft-Gault CrCl (TBW, female correction):
  CrCl = ((140 − age) × TBW) / (72 × SCr)   [× 0.85 if female]

IIV (used as prior log-SDs in MAP):
  ωCL = 0.29
  ωV1 = 0.32
  ωV2 = 0.28`}</pre>

          <p className="mt-4 text-xs" style={{ color: "#64748b" }}>
            Smit C et al. <em>Br J Clin Pharmacol</em>. 2020;86(2):303–317.&nbsp;
            <a href="https://doi.org/10.1111/bcp.14144" target="_blank" rel="noopener noreferrer" style={{ color: "#00c9b1" }}>
              doi:10.1111/bcp.14144 ↗
            </a>
            &nbsp;·&nbsp;
            Zhang T et al. <em>Clin Pharmacokinet</em>. 2024;63:79–91.&nbsp;
            <a href="https://doi.org/10.1007/s40262-023-01324-5" target="_blank" rel="noopener noreferrer" style={{ color: "#00c9b1" }}>
              doi:10.1007/s40262-023-01324-5 ↗
            </a>
            &nbsp;·&nbsp;
            Janmahasatian S et al. <em>Clin Pharmacokinet</em>. 2005;44(10):1051–1065.&nbsp;
            <a href="https://doi.org/10.2165/00003088-200544100-00004" target="_blank" rel="noopener noreferrer" style={{ color: "#00c9b1" }}>
              doi:10.2165/00003088-200544100-00004 ↗
            </a>
          </p>
        </div>
      </section>

      {/* ── SECTION 7: BAYESIAN POSTERIOR ──────────────────── */}
      <section className="px-6 py-16" style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            7. MAP-Bayesian posterior fitting
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            Given measured levels, Vancomyzer fits the patient&rsquo;s individual PK using maximum a
            posteriori (MAP) Bayesian estimation. It balances two things: how well the estimate fits the
            patient&rsquo;s measured concentrations (under a normal assay-error model), against how far it
            strays from the population priors (a log-normal prior on each PK parameter). The fit is
            repeated from several starting points so an unusual single level cannot drag the estimate to
            an implausible value.
          </p>

          <pre
            className="mt-6 overflow-x-auto rounded-lg p-5 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
              border: "1px solid #cbd5e1",
            }}
          >{`minimize  Σᵢ ½·((Cᵢ_obs − Cᵢ_pred) / σᵢ)² + ln(σᵢ)
        + ½·(ln(CL/CL_prior) / ω_CL)²
        + ½·(ln(V1/V1_prior) / ω_V1)²
        + ½·(ln(Q /Q_prior ) / ω_Q )²
        + ½·(ln(V2/V2_prior) / ω_V2)²

Assay error model:
  σᵢ = max(1.0 mcg/mL, 0.15 × max(Cᵢ_obs, Cᵢ_pred))

Bounds: each posterior parameter clamped to [0.1×, 10×] of prior.

Prior log-SDs (default):
  ω_CL = 0.35    ω_V1 = 0.25    ω_Q = 0.50    ω_V2 = 0.50
  (overridden by Smit 2020 ωs in obesity branch)`}</pre>

          <p className="mt-4 text-sm leading-relaxed" style={{ color: "#334155" }}>
            By design, a single observation cannot dominate the prior — that&rsquo;s the safety property MAP
            estimation provides. When the residual exceeds 25% relative error, the calculator surfaces a
            Fit Quality Advisory and recommends a confirmatory level rather than overriding the prior.
          </p>
        </div>
      </section>

      {/* ── SECTION 8: AUC TARGET ──────────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            8. AUC₂₄ target — ASHP/IDSA/PIDS/SIDP 2020
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: "#334155" }}>
            The therapeutic target of <strong>AUC₂₄ 400–600 mg·h/L</strong> (assuming MIC = 1 mg/L) follows
            the 2020 revised consensus guideline. It replaces trough-only monitoring for serious MRSA
            infections, citing improved nephrotoxicity outcomes at equivalent efficacy. The engine&rsquo;s
            recommendation search picks the dose × interval combination whose predicted steady-state AUC
            sits closest to the midpoint of this range.
          </p>
          <p className="mt-4 text-xs" style={{ color: "#64748b" }}>
            Rybak MJ et al. <em>Am J Health Syst Pharm</em>. 2020;77(11):835–864.&nbsp;
            <a href="https://doi.org/10.1093/ajhp/zxaa036" target="_blank" rel="noopener noreferrer" style={{ color: "#00c9b1" }}>
              doi:10.1093/ajhp/zxaa036 ↗
            </a>
          </p>
        </div>
      </section>

      {/* ── FOUNDATIONAL TEXTS + DISCLAIMER ────────────────── */}
      <section className="manifesto-dark px-6 py-16" style={{ background: "#0f172a" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: "#ffffff" }}>
            Foundational texts
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
            <li>
              Rowland M, Tozer TN. <em>Clinical Pharmacokinetics and Pharmacodynamics: Concepts and Applications.</em> 4th ed. Lippincott Williams &amp; Wilkins; 2011.
            </li>
            <li>
              Gibaldi M, Perrier D. <em>Pharmacokinetics.</em> 2nd ed. Marcel Dekker; 1982.
            </li>
          </ul>

          <div className="mt-10 rounded-md border-l-4 px-5 py-4" style={{ borderColor: "#fbbf24", background: "#1e293b" }}>
            <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>
              Decision-support, not a substitute for judgment
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
              These models, equations, and references are exposed for transparency and audit. Vancomyzer&trade;
              is non-device clinical decision support under 21st Century Cures Act §3060. Every recommendation
              must be independently reviewed by a licensed clinician. See the full{" "}
              <a href="/disclaimer" style={{ color: "#00c9b1", textDecoration: "underline" }}>Medical Disclaimer</a>.
            </p>
          </div>

          <div className="mt-10 flex gap-4">
            <Link
              href="/transparent-dosing"
              className="cta-primary inline-block rounded-md px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition"
              style={{ background: "#00c9b1", color: "#0f172a", letterSpacing: "0.08em" }}
            >
              ← Back to manifesto
            </Link>
            <Link
              href="/register"
              className="cta-outline inline-block rounded-md border-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition"
              style={{ borderColor: "#cbd5e1", color: "#ffffff", letterSpacing: "0.08em" }}
            >
              Try the calculator →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
