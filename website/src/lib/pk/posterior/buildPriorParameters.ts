/**
 * Colin 2019 two-compartment population PK model for vancomycin.
 *
 * Source: Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767–780.
 * DOI: 10.1007/s40262-018-0727-5
 *
 * Exact equations from the full-text paper (Eqs 6–13, Table 3):
 *
 *   CL (L/h) = θCL × FSize^0.75 × FMat × FDecline × FSCR
 *   V1 (L)   = θV1 × FSize^1
 *   V2 (L)   = θV2 × FSize^1
 *   Q  (L/h) = θQ2 × FSize^0.75
 *
 *   FSize    = (WT/70)
 *   FMat     = PMA(wk)^γ1 / (PMA(wk)^γ1 + PMA50(wk)^γ1)
 *   FDecline = 1 / (1 + (PMA(yr)/AGE50)^γ2)         [= AGE50^γ2/(AGE50^γ2+PMA(yr)^γ2)]
 *   FSCR     = exp(-θSCR × (SCr(mg/dL) − SCRstd))
 *   SCRstd   = exp(-1.228 + log10(PMA(yr))×0.672 + 6.27×exp(-3.11×PMA(yr)))
 *
 * Table 3 parameter estimates:
 *   θCL  = 5.31 L/h/70kg
 *   θV1  = 42.9 L/70kg
 *   θV2  = 41.7 L/70kg
 *   θQ2  = 3.22 L/h/70kg
 *   PMA50 = 46.4 weeks (maturation)
 *   γ1   = 2.89
 *   AGE50 = 61.6 years (age-decline, 50% CL reduction at this age)
 *   γ2   = 2.24
 *   θSCR = 0.649 (SCr effect on CL, mg/dL scale)
 *
 * Verification: 35yo, 70kg, SCr 0.83 mg/dL → CL = 4.10 L/h ✓
 *
 * Adult-only scope: FMat ≈ 1.000 for all adults ≥18yo (PMA >> PMA50 in weeks).
 * PMA for adults = (age_years + 40/52) years, or (age_years × 52 + 40) weeks.
 *
 * Note: STDY10 (haematological malignancy ×1.294) and STDY13 (heel prick) 
 * covariates are not included here as they are not clinically relevant 
 * for standard adult TDM dosing contexts.
 */

import type { NormalizedPatient, NormalizedRegimen } from "../types";

// ── Table 3 parameter estimates ──────────────────────────────────────────────
const THETA_CL   = 5.31;   // maximum CL (L/h per 70 kg)
const THETA_V1   = 42.9;   // central volume (L per 70 kg)
const THETA_V2   = 41.7;   // peripheral volume (L per 70 kg)
const THETA_Q    = 3.22;   // intercompartmental clearance (L/h per 70 kg)
const PMA50_WK   = 46.4;   // PMA at 50% maturation (weeks)
const GAMMA1     = 2.89;   // maturation Hill exponent
const AGE50_YR   = 61.6;   // age at 50% decline (years)
const GAMMA2     = 2.24;   // decline Hill exponent
const THETA_SCR  = 0.649;  // SCr effect on CL (mg/dL scale)

// Numeric floors
const MIN_WT_KG  = 30;
const MIN_SCR    = 0.4;    // prevents division issues; floored SCr

export const ADULT_VANCOMYCIN_PRIOR_MODEL = {
  id: "colin-2019-two-compartment",
  label: "Colin 2019 — two-compartment adult population PK prior",
  structuralModel: "Two-compartment intermittent IV infusion",
  covariates: "Weight (allometric 0.75), PMA-based maturation + age-decline sigmoid, SCr (direct, mg/dL)",
  clearance: {
    equation: "CL = 5.31 × (WT/70)^0.75 × FMat × FDecline × exp(-0.649×(SCr−SCRstd))",
    age_decline: "FDecline = 1/(1+(PMA_yr/61.6)^2.24) — 50% CL reduction at age 61.6 years",
    scr_note: "SCr used directly (mg/dL) as published covariate. Cockcroft-Gault NOT used.",
    reference_patient: "35yr, 70kg, SCr 0.83 mg/dL → CL 4.10 L/h ✓",
    source: "Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767–780. Eqs 6–13, Table 3.",
  },
} as const;

export interface PriorParameters {
  CL: number;
  V1: number;
  Q:  number;
  V2: number;
  scr: number;
}

/** SCRstd (Eq. 5): age-adjusted normal SCr as a function of PMA */
function computeSCRstd(PMA_yr: number): number {
  return Math.exp(
    -1.228
    + Math.log10(PMA_yr) * 0.672
    + 6.27 * Math.exp(-3.11 * PMA_yr)
  );
}

/** FMat (Eq. 11): sigmoidal maturation — effectively 1.0 for all adults */
function computeFMat(PMA_wk: number): number {
  return (PMA_wk ** GAMMA1) / (PMA_wk ** GAMMA1 + PMA50_WK ** GAMMA1);
}

/** FDecline (Eq. 12): age-induced CL deterioration; 0.5 at AGE50_YR */
function computeFDecline(PMA_yr: number): number {
  return 1 / (1 + (PMA_yr / AGE50_YR) ** GAMMA2);
}

/** FSCR (Eq. 13): SCr effect on CL */
function computeFSCR(scr_mgdl: number, SCRstd: number): number {
  return Math.exp(-THETA_SCR * (scr_mgdl - SCRstd));
}

export function buildPriorParameters(
  patient: NormalizedPatient,
  _regimen: NormalizedRegimen
): PriorParameters {
  const wt  = Math.max(MIN_WT_KG, patient.weight_kg);
  const scr = Math.max(MIN_SCR, patient.serum_creatinine_mg_dl);
  const age = Math.max(18, patient.age);

  // ---------------------------------------------------------------------------
  // Obesity Model Branch — activates when BMI ≥ 40 AND height/sex are provided
  // Uses FFM-based Vd (Smit 2020 + Zhang 2023) instead of TBW-based Colin 2019
  // ---------------------------------------------------------------------------
  if (patient.height_cm > 0 && (patient.sex === "male" || patient.sex === "female")) {
    const { calculateBMI, selectPKModel, buildObesityPriors } = require("../obesityModel");
    const bmi = calculateBMI(wt, patient.height_cm);
    if (bmi >= 40) {
      const model = selectPKModel(bmi);
      if (model === "vancomyzer_obesity") {
        const priors = buildObesityPriors(age, wt, patient.height_cm, scr, patient.sex);
        return { CL: priors.CL, V1: priors.V1, Q: priors.Q, V2: priors.V2, scr };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Colin 2019 Model — default for non-obese patients (unchanged)
  // ---------------------------------------------------------------------------

  // Adults: PMA = age_years + 40 weeks gestation (standard assumption)
  const PMA_yr = age + 40 / 52;
  const PMA_wk = PMA_yr * 52;

  // Size scaling (allometric)
  const FSize = wt / 70;

  // Covariate functions
  const FMat     = computeFMat(PMA_wk);
  const FDecline = computeFDecline(PMA_yr);
  const SCRstd   = computeSCRstd(PMA_yr);
  const FSCR     = computeFSCR(scr, SCRstd);

  const CL = THETA_CL * (FSize ** 0.75) * FMat * FDecline * FSCR;
  const V1 = THETA_V1 * FSize;
  const V2 = THETA_V2 * FSize;
  const Q  = THETA_Q  * (FSize ** 0.75);

  return { CL, V1, Q, V2, scr };
}
