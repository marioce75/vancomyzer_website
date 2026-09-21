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
 *
 * Colin 2019 is used for EVERY adult, at every body size. The former custom
 * BMI ≥ 40 obesity branch was retired from dosing on 2026-09-15 (see
 * modelRegistry.ts, VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED, for the reasons).
 * Parameter values come from the model registry so the equations shown to
 * clinicians and the numbers used here cannot drift apart.
 */

import type { NormalizedPatient, NormalizedRegimen } from "../types";
import { COLIN_2019, COLIN_2019_PARAMETERS, type PkModelId } from "../modelRegistry";

// ── Table 3 parameter estimates (from the model registry) ────────────────────
const THETA_CL   = COLIN_2019_PARAMETERS.thetaCL;            // maximum CL (L/h per 70 kg)
const THETA_V1   = COLIN_2019_PARAMETERS.thetaV1;            // central volume (L per 70 kg)
const THETA_V2   = COLIN_2019_PARAMETERS.thetaV2;            // peripheral volume (L per 70 kg)
const THETA_Q    = COLIN_2019_PARAMETERS.thetaQ;             // intercompartmental clearance (L/h per 70 kg)
const PMA50_WK   = COLIN_2019_PARAMETERS.pma50Weeks;         // PMA at 50% maturation (weeks)
const GAMMA1     = COLIN_2019_PARAMETERS.hillMaturation;     // maturation Hill exponent
const AGE50_YR   = COLIN_2019_PARAMETERS.age50DeclineYears;  // PMA (years) at 50% decline
const GAMMA2     = COLIN_2019_PARAMETERS.hillDecline;        // decline Hill exponent
const THETA_SCR  = COLIN_2019_PARAMETERS.thetaSCr;           // SCr effect on CL (per mg/dL)

// Numeric floors
const MIN_WT_KG  = 30;

/**
 * There is deliberately NO clearance floor in this file.
 *
 * Colin 2019's FSCR term is a bare exponential in serum creatinine with no
 * lower bound, so at high SCr the prior clearance falls below anything
 * physiological — at SCr 6.0 it returns 0.106 L/h for a 65 y / 80 kg adult
 * whose true clearance is about 0.7 L/h. That is a real defect, but flooring it
 * HERE would mean the engine no longer reproduces Colin 2019 as published: it
 * moved 1944 of 10800 grid points away from an independent re-implementation
 * (worst 5.64x at SCr 6) and would have broken the promise this site makes on
 * its Transparency and equations pages. It is also the exact pattern the
 * 15 Sep 2026 review criticised and that the custom obesity model was retired
 * for — a house modification silently applied to a published model.
 *
 * The prior therefore stays faithful, and the collapse is handled downstream
 * where it does harm: the posterior clearance is bounded at a physiological
 * non-renal floor and an explicit extrapolation advisory is raised. See
 * posteriorEngine.ts (MIN_NONRENAL_CL_L_H_PER_70KG).
 */

export const ADULT_VANCOMYCIN_PRIOR_MODEL = {
  id: "colin-2019-two-compartment",
  label: `${COLIN_2019.shortName} — two-compartment adult population PK prior`,
  structuralModel: COLIN_2019.structure,
  covariates: "Weight (allometric 0.75), PMA-based maturation + age-decline sigmoid, SCr (direct, mg/dL)",
  clearance: {
    equation: COLIN_2019.equations.CL,
    age_decline: COLIN_2019.equations.FDecline,
    scr_note: COLIN_2019.renalCovariate,
    reference_patient: `${COLIN_2019.referenceCheck.input}  CL ${COLIN_2019.referenceCheck.expectedCL_L_h.toFixed(2)} L/h`,
    source: `${COLIN_2019.citation} Eqs 6–13, Table 3.`,
  },
} as const;

export interface PriorParameters {
  CL: number;
  V1: number;
  Q:  number;
  V2: number;
  scr: number;
  /** Always "colin_2019" for new calculations; the union keeps historical ids typed. */
  model_name: PkModelId;
  ffm_kg?: number;       // Fat-Free Mass — not set: no dosing path scales volumes to FFM
  omega_CL?: number;     // Optional IIV overrides for the MAP fit (none are currently set)
  omega_V1?: number;
  omega_Q?: number;
  omega_V2?: number;
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
  // Serum creatinine is used as entered. The previous 0.4 mg/dL floor was
  // justified in-code as preventing "division issues", which is not true of
  // Colin 2019 — SCr appears inside exp(-0.649 x (SCr - SCRstd)), which is
  // finite at every value, and the API already bounds the input to 0.1-10 mg/dL.
  // The floor understated clearance by up to 17.7% in exactly the augmented-
  // clearance population it mattered for, and suppressed the ARC advisory by
  // forcing the exposure back into range. Winter 2012 (n = 3678) likewise found
  // that rounding a low creatinine up made dose prediction worse, not better.
  const scr = patient.serum_creatinine_mg_dl;
  const age = Math.max(18, patient.age);

  // ---------------------------------------------------------------------------
  // Colin 2019 — the only dosing model, for every adult at every body size.
  // There is deliberately no BMI-based model switch (the retired custom obesity
  // branch produced a step change at BMI 40). BMI ≥ 40 gets an advisory
  // (modelRegistry.highBmiAdvisory), never a different model.
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

  return { CL, V1, Q, V2, scr, model_name: "colin_2019" as const };
}
