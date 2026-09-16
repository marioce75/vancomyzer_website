/**
 * Vancomyzer PK model registry — the single source of truth for every
 * population-PK model name, citation, parameter value, equation string and
 * status that appears in engine notes, the calculator UI, PDF exports and the
 * public methods pages.
 *
 * Rules
 *  1. Do not hard-code a model name, citation or equation string anywhere else.
 *     Import it from here. Equation strings are generated from the same numeric
 *     parameters the engine imports, so documentation and math cannot drift.
 *  2. Any change to a model's parameters, structure or status bumps
 *     MODEL_MANIFEST_VERSION and adds a CHANGELOG line below.
 *  3. A "retired" model must not be reachable from any dosing path. Its record
 *     stays here so stored historical calculations remain interpretable.
 *  4. Published models listed under PUBLISHED_OBESITY_COMPARATORS are
 *     documentation only. They are NOT implemented by the engine.
 *
 * CHANGELOG
 *  2026-09-15.1  Registry created. The custom BMI >= 40 obesity branch was
 *                retired from dosing; all adults use Colin 2019. (External
 *                review "Vancomyzer: international comparison and improvement
 *                plan", 15 Sep 2026, sections 06-07.)
 */

export const MODEL_MANIFEST_VERSION = "2026-09-15.1";

/** Model ids that can appear in engine output or stored history rows. */
export type PkModelId = "colin_2019" | "vancomyzer_obesity";

// ---------------------------------------------------------------------------
// Colin 2019 — the only model used for dosing
// ---------------------------------------------------------------------------

/** Table 3 typical values (Colin et al. 2019). Imported by buildPriorParameters. */
export const COLIN_2019_PARAMETERS = {
  thetaCL: 5.31, // L/h per 70 kg (maximum adult CL before age decline and SCr effect)
  thetaV1: 42.9, // L per 70 kg
  thetaV2: 41.7, // L per 70 kg
  thetaQ: 3.22, // L/h per 70 kg
  pma50Weeks: 46.4, // maturation half-point, postmenstrual weeks
  hillMaturation: 2.89,
  age50DeclineYears: 61.6, // PMA (years) at which CL is halved by ageing
  hillDecline: 2.24,
  thetaSCr: 0.649, // per mg/dL
} as const;

const P = COLIN_2019_PARAMETERS;

export const COLIN_2019 = {
  id: "colin_2019" as const,
  status: "active" as const,
  shortName: "Colin 2019",
  displayName: "Colin 2019 two-compartment population PK model",
  citation:
    "Colin PJ, et al. Vancomycin pharmacokinetics throughout life: results from a pooled population analysis and evaluation of current dosing recommendations. Clin Pharmacokinet. 2019;58(6):767-780.",
  doi: "10.1007/s40262-018-0727-5",
  structure: "Two-compartment model, intermittent IV infusion, first-order elimination",
  sourcePopulation:
    "Pooled population analysis of data from 14 studies (2,554 individuals), from neonates to elderly adults.",
  vancomyzerScope:
    "Adults (18 years and older) receiving intermittent IV vancomycin who are not on renal replacement therapy. Used for every body size, including BMI 40 kg/m2 and above.",
  equations: {
    CL: `CL (L/h) = ${P.thetaCL} × (WT/70)^0.75 × FMat × FDecline × FSCR`,
    V1: `V1 (L) = ${P.thetaV1} × (WT/70)`,
    V2: `V2 (L) = ${P.thetaV2} × (WT/70)`,
    Q: `Q (L/h) = ${P.thetaQ} × (WT/70)^0.75`,
    PMA: "PMA (years) = age (years) + 40/52",
    FMat: `FMat = PMAwk^${P.hillMaturation} / (PMAwk^${P.hillMaturation} + ${P.pma50Weeks}^${P.hillMaturation}) (≈1 for adults)`,
    FDecline: `FDecline = 1 / (1 + (PMA/${P.age50DeclineYears})^${P.hillDecline})`,
    FSCR: `FSCR = exp(−${P.thetaSCr} × (SCr − SCRstd)), SCr in mg/dL`,
    SCRstd: "SCRstd = exp(−1.228 + 0.672 × log10(PMA) + 6.27 × exp(−3.11 × PMA))",
  },
  renalCovariate:
    `Serum creatinine is used directly (mg/dL) as the Colin 2019 renal covariate: FSCR = exp(−${P.thetaSCr} × (SCr − SCRstd)), where SCRstd is the age-standardised reference creatinine. Cockcroft-Gault creatinine clearance is not used to estimate vancomycin clearance.`,
  /** Covariates in the published final model that Vancomyzer does not apply. */
  omittedCovariates: [
    "Haematological malignancy (+29.4% CL in the published model): not captured as an input.",
    "Heel-prick sampling (neonatal): not applicable to adult venous sampling.",
  ],
  /** Published variability, for documentation. The MAP fit's own prior SDs live in fitPosteriorParameters.ts. */
  publishedVariability: {
    iivCvCL: 0.279,
    iivCvV1: 0.273,
    iivCvV2: 0.979,
    residualProportional: 0.215,
  },
  referenceCheck: {
    input: "Age 35 y, weight 70 kg, SCr 0.83 mg/dL",
    expectedCL_L_h: 4.1,
    expectedV1_L: 42.9,
    expectedV2_L: 41.7,
    expectedQ_L_h: 3.22,
  },
} as const;

// ---------------------------------------------------------------------------
// Retired model — kept only to interpret historical records
// ---------------------------------------------------------------------------

export const VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED = {
  id: "vancomyzer_obesity" as const,
  status: "retired" as const,
  retiredOn: "2026-09-15",
  shortName: "Vancomyzer custom obesity model (retired)",
  displayName: "Vancomyzer custom obesity model — retired from dosing on 15 Sep 2026",
  formerScope: "Adults with BMI of 40 kg/m2 or more when height and sex were entered (until 15 Sep 2026).",
  equations: {
    CL: "CL (L/h) = (0.0571 × CrCl[Cockcroft-Gault, total body weight] + 0.0158 × TBW) × 1/(1 + (age/61.6)^2.24)",
    V1: "V1 (L) = 0.287 × FFM (Janmahasatian 2005)",
    V2: "V2 (L) = 0.89 × FFM",
    Q: "Q (L/h) = 1.23",
  },
  whyRetired: [
    "It was a Vancomyzer composition: its coefficients do not appear in Smit 2020 or Zhang 2024, neither paper validates it, and it was never externally validated.",
    "Switching models at BMI 40 caused a step change in estimates. Example: a 35-year-old man, 175 cm, SCr 0.83 mg/dL, moving from BMI 39.9 to 40.0 (+0.3 kg) changed CL from 6.2 to 11.1 L/h and V1 from 75 to 21 L.",
    "Clearance rose linearly with Cockcroft-Gault CrCl on total body weight with no upper bound, and the Cockcroft-Gault age term was combined with a second age-decline factor.",
  ],
  replacedBy: "colin_2019" as const,
} as const;

// ---------------------------------------------------------------------------
// Published obesity models — documentation only, NOT implemented
// ---------------------------------------------------------------------------

export const PUBLISHED_OBESITY_COMPARATORS = [
  {
    id: "smit_2020",
    shortName: "Smit 2020",
    citation:
      "Smit C, et al. Population pharmacokinetics of vancomycin in obesity: finding the optimal dose for (morbidly) obese individuals. Br J Clin Pharmacol. 2020;86(2):303-317.",
    doi: "10.1111/bcp.14144",
    clearance: "CL (L/h) = 5.72 × (TBW/70)^0.535 (three-compartment model; no renal-function or age covariate on CL)",
    population:
      "20 morbidly obese adults undergoing bariatric surgery (110.6-234.6 kg, age 23-54, eGFR 60 or more) and 8 non-obese volunteers; single dose; no ICU patients.",
    status: "not implemented",
  },
  {
    id: "zhang_2024",
    shortName: "Zhang 2024",
    citation:
      "Zhang T, et al. How to dose vancomycin in overweight and obese patients with varying renal (dys)function in the novel era of AUC 400-600 mg·h/L-targeted dosing. Clin Pharmacokinet. 2024;63(1):79-91.",
    doi: "10.1007/s40262-023-01324-5",
    clearance:
      "CL (L/h) = 3.36 × (CKD-EPI eGFR/75)^0.658 × [1 + 0.0106 × (TBW − 90)] × 0.845 if ICU (three-compartment model)",
    population: "210 overweight or obese adults (53 ICU) pooled with the Smit 2020 bariatric cohort.",
    status: "not implemented",
  },
] as const;

export const COLIN_2021_OBESE_EVALUATION = {
  citation: "Colin PJ, et al. Ther Drug Monit. 2021;43(1):126-130. PMID: 33278242.",
  summary:
    "External evaluation in 49 obese adults (15 with BMI of 40 or more). Colin 2019 had the lowest a-priori imprecision and the best a-posteriori bias and imprecision among the models compared; the cohort is small.",
} as const;

// ---------------------------------------------------------------------------
// Helpers used by the engine, UI and exports
// ---------------------------------------------------------------------------

type ModelRecord = typeof COLIN_2019 | typeof VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED;

export function modelRecord(id: string | null | undefined): ModelRecord {
  return id === VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED.id ? VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED : COLIN_2019;
}

/** Short label for notes, cards and tables, e.g. "Colin 2019". */
export function modelShortName(id: string | null | undefined): string {
  return modelRecord(id).shortName;
}

/** Full label, e.g. "Colin 2019 two-compartment population PK model". */
export function modelDisplayName(id: string | null | undefined): string {
  return modelRecord(id).displayName;
}

/** One-sentence description of how renal function enters the model that ran. */
export function renalCovariateDescription(id: string | null | undefined): string {
  if (id === VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED.id) {
    return `Clearance used the retired custom obesity model: ${VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED.equations.CL}.`;
  }
  return COLIN_2019.renalCovariate;
}

export const HIGH_BMI_THRESHOLD_KG_M2 = 40;
/** Weight above which a missing height is worth flagging (BMI could plausibly be 40 or more). */
const HEIGHT_MISSING_WEIGHT_FLAG_KG = 120;

export function computeBmi(weight_kg: number, height_cm: number | null | undefined): number | null {
  if (!Number.isFinite(weight_kg) || weight_kg <= 0) return null;
  if (!height_cm || !Number.isFinite(height_cm) || height_cm <= 0) return null;
  const m = height_cm / 100;
  return weight_kg / (m * m);
}

/**
 * Advisory for high body size. There is no model switch at any BMI; this text
 * tells the clinician that evidence for Colin 2019 at BMI >= 40 is limited.
 */
export function highBmiAdvisory(patient: { weight_kg: number; height_cm?: number | null }): string | null {
  const bmi = computeBmi(patient.weight_kg, patient.height_cm);
  if (bmi != null && bmi >= HIGH_BMI_THRESHOLD_KG_M2) {
    return (
      `BMI ${bmi.toFixed(1)} kg/m² (40 or more): estimates use the Colin 2019 model with total-body-weight scaling, the same model used for all adults. ` +
      "Published evaluation of this model at BMI 40 or more is limited (Colin 2021: 15 of 49 obese adults), so obtain vancomycin levels early to individualize. " +
      "Fat-free mass and alternative creatinine-clearance estimates are shown for information only and do not change the calculation."
    );
  }
  if (bmi == null && patient.weight_kg >= HEIGHT_MISSING_WEIGHT_FLAG_KG) {
    return (
      "Height was not entered, so BMI was not assessed. If BMI is 40 or more, published evaluation of the Colin 2019 model at that body size is limited; obtain vancomycin levels early."
    );
  }
  return null;
}
