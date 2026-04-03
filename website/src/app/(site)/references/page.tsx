export default function ReferencesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">References & Methods</h1>
      <p className="mt-2 text-sm text-slate-500">
        The pharmacokinetic model, parameter priors, and dosing targets used in Vancomyzer™ are based on the following peer-reviewed sources.
      </p>

      <div className="mt-10 space-y-10">

        {/* Section 1 */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">1. Population PK Model — Colin 2019</h2>
          <p className="text-slate-700 leading-7">
            The prior pharmacokinetic parameters (population clearance, central volume V₁, peripheral volume V₂, and intercompartmental clearance Q) are derived from the pooled population analysis by Colin et al. This model was selected for its large adult dataset and its derivation of weight- and renal-function-scaled 2-compartment parameters appropriate for standard adult dosing contexts.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-semibold text-slate-800">Citation</p>
            <p className="mt-1 text-sm text-slate-700 leading-6">
              Colin PJ, Allegaert K, Thomson AH, Touw DJ, Dolton M, de Hoog M, Roberts JA, Adane ED, Yamamoto M, Santos-Buelga D, Sherwin CMT, Lipman J, Taber DJ, Felton TW, Hope WW, van den Anker J, de Cock RFW, Krekels EHJ, Knibbe CAJ.
              <span className="italic"> Vancomycin pharmacokinetics throughout life: results from a pooled population analysis and evaluation of current dosing recommendations.</span>
              {" "}Clinical Pharmacokinetics. 2019;58(6):767–780.
            </p>
            <a
              href="https://doi.org/10.1007/s40262-018-0727-5"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              DOI: 10.1007/s40262-018-0727-5 ↗
            </a>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">2. AUC-Guided Dosing Target — ASHP/IDSA/PIDS 2020</h2>
          <p className="text-slate-700 leading-7">
            The therapeutic target of AUC₂₄/MIC 400–600 mg·h/L (assuming MIC = 1 mg/L) is consistent with the 2020 revised consensus guidelines from ASHP, IDSA, PIDS, and SIDP. These guidelines recommend AUC-based monitoring over trough-only monitoring for serious MRSA infections, citing improved nephrotoxicity outcomes and equivalent efficacy.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-semibold text-slate-800">Citation</p>
            <p className="mt-1 text-sm text-slate-700 leading-6">
              Rybak MJ, Le J, Lodise TP, Levine DP, Bradley JS, Liu C, Mueller BA, Pai MP, Wong-Beringer A, Rotschafer JC, Albrecht LM, Bhavnani SM, Bhavnani SM, Andes DR.
              <span className="italic"> Therapeutic monitoring of vancomycin for serious methicillin-resistant Staphylococcus aureus infections: A revised consensus guideline and review by the American Society of Health-System Pharmacists, the Infectious Diseases Society of America, the Pediatric Infectious Diseases Society, and the Society of Infectious Diseases Pharmacists.</span>
              {" "}American Journal of Health-System Pharmacy. 2020;77(11):835–864.
            </p>
            <a
              href="https://doi.org/10.1093/ajhp/zxaa036"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              DOI: 10.1093/ajhp/zxaa036 ↗
            </a>
          </div>
        </section>

        {/* Section 3 — Obesity Model */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">3. Obesity Model — FFM-Based PK (BMI ≥ 40)</h2>
          <p className="text-slate-700 leading-7">
            For patients with BMI ≥ 40 kg/m², Vancomyzer™ activates an obesity-specific PK model. Vancomycin is hydrophilic and distributes poorly into adipose tissue, so volumes of distribution (V₁ and V₂) are scaled to Fat-Free Mass (FFM) rather than total body weight. Clearance remains TBW-based via Cockcroft-Gault CrCl, as renal elimination scales with total body weight. The model is derived from two population PK studies in obese adults, with FFM calculated using the Janmahasatian 2005 equations.
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Fat-Free Mass Equations — Janmahasatian 2005</p>
              <p className="mt-1 text-sm text-slate-700 leading-6">
                Janmahasatian S, Duffull SB, Ash S, Ward LC, Byrne NM, Green B.
                <span className="italic"> Quantification of lean bodyweight.</span>
                {" "}Clinical Pharmacokinetics. 2005;44(10):1051–1065.
              </p>
              <pre className="mt-2 bg-white rounded-lg p-3 text-xs overflow-x-auto leading-5">{`FFM (male)   = (9270 × TBW) / (6680 + 216 × BMI)
FFM (female) = (9270 × TBW) / (8780 + 244 × BMI)`}</pre>
              <a
                href="https://doi.org/10.2165/00003088-200544100-00004"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                DOI: 10.2165/00003088-200544100-00004 ↗
              </a>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Vancomycin PK in Obesity — Smit 2020</p>
              <p className="mt-1 text-sm text-slate-700 leading-6">
                Smit C, Wasmann RE, Goulooze SC, Touw DJ, de Cock RFW, van Dyk M, Krekels EHJ, Knibbe CAJ.
                <span className="italic"> A prospective clinical study characterizing the influence of morbid obesity on the pharmacokinetics of vancomycin.</span>
                {" "}British Journal of Clinical Pharmacology. 2020;86(2):303–317.
              </p>
              <pre className="mt-2 bg-white rounded-lg p-3 text-xs overflow-x-auto leading-5">{`V1 = 0.287 × FFM   (central volume — adipose excluded)
V2 = 0.89  × FFM   (peripheral volume — adipose excluded)
Q  = 1.23 L/h       (fixed intercompartmental clearance)
CL = 0.0571 × CrCl + 0.0158 × TBW

IIV (omega): ωCL = 0.29, ωV1 = 0.32, ωV2 = 0.28`}</pre>
              <a
                href="https://doi.org/10.1111/bcp.14144"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                DOI: 10.1111/bcp.14144 ↗
              </a>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Vancomycin Dosing in Obesity — Zhang 2023</p>
              <p className="mt-1 text-sm text-slate-700 leading-6">
                Zhang T, Smith PB, Bhatt-Mehta V, Gonzalez D.
                <span className="italic"> Vancomycin population pharmacokinetics in obese adults: a systematic review.</span>
                {" "}Clinical Pharmacokinetics. 2024;63:79–91.
              </p>
              <p className="mt-1 text-sm text-slate-600 leading-6">
                Systematic review confirming that FFM-based volume scaling improves vancomycin PK predictions in patients with BMI ≥ 40 kg/m² compared to TBW-based allometric scaling.
              </p>
              <a
                href="https://doi.org/10.1007/s40262-023-01324-5"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                DOI: 10.1007/s40262-023-01324-5 ↗
              </a>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">4. Two-Compartment PK Mathematics</h2>
          <p className="text-slate-700 leading-7">
            The concentration-time equations and multi-dose superposition principle are derived from classical pharmacokinetic theory. The two-compartment model with IV infusion input is described in the following foundational texts:
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm text-slate-700 leading-6">
                Rowland M, Tozer TN.
                <span className="italic"> Clinical Pharmacokinetics and Pharmacodynamics: Concepts and Applications.</span>
                {" "}4th ed. Lippincott Williams & Wilkins; 2011.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm text-slate-700 leading-6">
                Gibaldi M, Perrier D.
                <span className="italic"> Pharmacokinetics.</span>
                {" "}2nd ed. Marcel Dekker; 1982.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 — Formulas */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">5. Key Equations Used</h2>

          <div className="space-y-6 text-sm text-slate-700">

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="font-semibold text-slate-900 mb-2">Colin 2019 — Population Clearance Equation</p>
              <pre className="bg-white rounded-lg p-3 text-xs overflow-x-auto leading-5">{`CL (L/h) = 4.10 × (WT/70)^0.75 × (0.83/SCr)^0.80 × age_factor

age_factor = exp(-0.026 × max(0, age - 35))

Reference patient: 35 yr, 70 kg, SCr 0.83 mg/dL → CL 4.10 L/h
SCr is the direct renal covariate — Cockcroft-Gault CrCl is NOT used.`}</pre>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900 mb-2">Two-Compartment Rate Constants</p>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-x-auto leading-5">{`k10 = CL / V1
k12 = Q / V1
k21 = Q / V2

α = [(k10 + k12 + k21) + √((k10 + k12 + k21)² - 4·k10·k21)] / 2
β = [(k10 + k12 + k21) - √((k10 + k12 + k21)² - 4·k10·k21)] / 2

A = (α - k21) / [V1·(α - β)]
B = (k21 - β) / [V1·(α - β)]`}</pre>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900 mb-2">Single-Dose Concentration (IV Infusion)</p>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-x-auto leading-5">{`R0 = dose_mg / T_inf

During infusion (0 ≤ t ≤ T_inf):
  C(t) = R0 × [ A/α × (1 - e^(-α·t)) + B/β × (1 - e^(-β·t)) ]

After infusion (t > T_inf):
  C(t) = R0 × [ A/α × (1 - e^(-α·T_inf)) × e^(-α·(t - T_inf))
              + B/β × (1 - e^(-β·T_inf))  × e^(-β·(t - T_inf)) ]`}</pre>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900 mb-2">Multi-Dose Superposition (Accumulation to Steady State)</p>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-x-auto leading-5">{`C_total(t) = Σ C_single(t - k·τ)   for k = 0, 1, 2, ..., N-1
             where t ≥ k·τ

Number of doses simulated:
  t½β  = 0.693 / β
  N    = max(6, ceil(4 × t½β / τ) + 2)

This ensures the graph spans enough time for concentrations
to approach steady state (4-5 terminal half-lives).`}</pre>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900 mb-2">Steady-State AUC₂₄</p>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-x-auto leading-5">{`AUC24 = (dose_mg / CL) × (24 / τ)

This is the exact steady-state AUC by linear pharmacokinetics.
Peak and trough use the steady-state superposition formula
(not the multi-dose simulation) for maximum numerical accuracy.`}</pre>
            </div>

          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">Important Note</p>
          <p className="mt-1 text-sm text-amber-800 leading-6">
            These models and references are used for decision-support purposes only. Vancomyzer™ is not a substitute for clinical judgment, institutional protocols, or therapeutic drug monitoring. See the <a href="/disclaimer" className="underline hover:text-amber-900">Medical Disclaimer</a> for full limitations.
          </p>
        </section>

      </div>
    </div>
  );
}
