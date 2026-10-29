/**
 * Colin 2019 covariate model for the pediatric preview — typical (population)
 * and individual (η-specific) parameters in both documented formulations.
 *
 * Implements the supplementary control stream literally:
 *
 *   SCRstd = exp(a + b·log10(PMA) + c·exp(d·PMA))          PMA in years
 *   Fsize  = WGT/70
 *   Fmat   = PMA^GAM / (PMA^GAM + MAT50^GAM)
 *   Fage   = PMA^GAM2 / (PMA^GAM2 + DEG50^GAM2)            GAM2 = −e^θ8
 *   Fscr   = exp(−EXPO2 · (SCR − SCRstd))                    SCR in mg/dL
 *   V1     = e^θ2 · Fsize · (1 − HEEL·θ10) · e^η2
 *   V2     = e^θ3 · Fsize · e^η3
 *   CL     = e^θ1 · (V1/e^θ2)^0.75 · Fmat/Fmat_R · Fage/Fage_R · Fscr · (1 + CANCER·θ12) · e^η1
 *   Q      = e^θ4 · (V2/e^θ3)^0.75 · (1 − HEEL·θ11)
 *
 * Compartmental allometry couples CL to the individual V1 (η2) and Q to the
 * individual V2 (η3); the MAP fit therefore optimises η, never CL/V1/V2 directly.
 *
 * "article_transcription" uses Table 3 / Eq. 5 rounded coefficients and omits
 * the /Fmat_R and /Fage_R terms (article Eq. 6). It is computed for the
 * sensitivity row only. See manifest.ts for why.
 */

import type { TwoCompartmentParameters } from "@/lib/pk/steadyStateTwoCompartment";
import {
  COLIN_2019_ARTICLE_TABLE3 as A,
  COLIN_2019_NONMEM_FINAL as N,
  type Colin2019Formulation,
} from "./manifest";

export interface PediatricCovariates {
  pmaYears: number;
  weightKg: number;
  scrMgDl: number;
  /** STDY 13 effect (heel-prick sampling). Not exposed in the UI; default false. */
  heelPrick?: boolean;
  /** STDY 10 effect (haematological malignancy). Not exposed in the UI; default false. */
  haematologicalMalignancy?: boolean;
}

export interface Eta {
  CL: number;
  V1: number;
  V2: number;
}

export const ETA_ZERO: Eta = { CL: 0, V1: 0, V2: 0 };

export interface CovariateFactors {
  scrStd: number;
  fSize: number;
  fMat: number;
  fAge: number;
  fScr: number;
  /** Reference-individual factors (1 when not normalised). */
  fMatRef: number;
  fAgeRef: number;
  /** Multiplier applied to clearance by the normalisation: 1/(fMatRef·fAgeRef). */
  normalisation: number;
}

export interface TypicalParameters extends TwoCompartmentParameters {
  factors: CovariateFactors;
  formulation: Colin2019Formulation;
}

const nonmem = {
  clRef: Math.exp(N.theta.lnCLref),
  v1: Math.exp(N.theta.lnV1),
  v2: Math.exp(N.theta.lnV2),
  q: Math.exp(N.theta.lnQ),
  deg50: Math.exp(N.theta.lnDEG50),
  mat50: Math.exp(N.theta.lnMAT50),
  gam: Math.exp(N.theta.lnGAM),
  gam2: -Math.exp(N.theta.lnGAM2),
  expo2: Math.exp(N.theta.lnEXPO2),
  heelV1: N.theta.heelV1,
  heelQ: N.theta.heelQ,
  cancerCL: N.theta.cancerCL,
};

/** Fixed effects exposed for documentation and tests (natural scale). */
export const COLIN_2019_FITTED_FIXED_EFFECTS = {
  clReferenceLh: nonmem.clRef,
  v1Per70kgL: nonmem.v1,
  v2Per70kgL: nonmem.v2,
  qPer70kgLh: nonmem.q,
  deg50Years: nonmem.deg50,
  mat50Years: nonmem.mat50,
  mat50Weeks: nonmem.mat50 * 52,
  gammaMaturation: nonmem.gam,
  gammaDecline: -nonmem.gam2,
  scrCoefficientPerMgDl: nonmem.expo2,
} as const;

export function scrStdMgDl(pmaYears: number, formulation: Colin2019Formulation = "fitted_nonmem"): number {
  const c = formulation === "fitted_nonmem" ? N.scrStd : A.scrStd;
  return Math.exp(c.a + c.b * Math.log10(pmaYears) + c.c * Math.exp(c.d * pmaYears));
}

function maturation(pmaYears: number, formulation: Colin2019Formulation): number {
  if (formulation === "fitted_nonmem") {
    const p = Math.pow(pmaYears, nonmem.gam);
    return p / (p + Math.pow(nonmem.mat50, nonmem.gam));
  }
  const wk = pmaYears * 52;
  const p = Math.pow(wk, A.gamma1);
  return p / (p + Math.pow(A.pma50Weeks, A.gamma1));
}

function decline(pmaYears: number, formulation: Colin2019Formulation): number {
  if (formulation === "fitted_nonmem") {
    // PMA^GAM2/(PMA^GAM2 + DEG50^GAM2) with GAM2 < 0 — identical to 1/(1+(PMA/DEG50)^|GAM2|).
    const p = Math.pow(pmaYears, nonmem.gam2);
    return p / (p + Math.pow(nonmem.deg50, nonmem.gam2));
  }
  return 1 / (1 + Math.pow(pmaYears / A.age50Years, A.gamma2));
}

export function covariateFactors(cov: PediatricCovariates, formulation: Colin2019Formulation): CovariateFactors {
  const scrStd = scrStdMgDl(cov.pmaYears, formulation);
  const fSize = cov.weightKg / 70;
  const fMat = maturation(cov.pmaYears, formulation);
  const fAge = decline(cov.pmaYears, formulation);
  const coeff = formulation === "fitted_nonmem" ? nonmem.expo2 : A.thetaSCr;
  const fScr = Math.exp(-coeff * (cov.scrMgDl - scrStd));
  const fMatRef = formulation === "fitted_nonmem" ? maturation(N.pmaReferenceYears, formulation) : 1;
  const fAgeRef = formulation === "fitted_nonmem" ? decline(N.pmaReferenceYears, formulation) : 1;
  return { scrStd, fSize, fMat, fAge, fScr, fMatRef, fAgeRef, normalisation: 1 / (fMatRef * fAgeRef) };
}

/**
 * Individual parameters for a given η vector (η = 0 gives the typical
 * individual). Study effects default to off.
 */
export function individualParameters(
  cov: PediatricCovariates,
  eta: Eta,
  formulation: Colin2019Formulation = "fitted_nonmem",
): TypicalParameters {
  const f = covariateFactors(cov, formulation);
  const heel = cov.heelPrick ? 1 : 0;
  const cancer = cov.haematologicalMalignancy ? 1 : 0;
  if (formulation === "fitted_nonmem") {
    const V1 = nonmem.v1 * f.fSize * (1 - heel * nonmem.heelV1) * Math.exp(eta.V1);
    const V2 = nonmem.v2 * f.fSize * Math.exp(eta.V2);
    const CL =
      nonmem.clRef *
      Math.pow(V1 / nonmem.v1, 0.75) *
      (f.fMat / f.fMatRef) *
      (f.fAge / f.fAgeRef) *
      f.fScr *
      (1 + cancer * nonmem.cancerCL) *
      Math.exp(eta.CL);
    const Q = nonmem.q * Math.pow(V2 / nonmem.v2, 0.75) * (1 - heel * nonmem.heelQ);
    return { CL, V1, V2, Q, factors: f, formulation };
  }
  const V1 = A.thetaV1 * f.fSize * (1 - heel * A.thetaStdy13V1) * Math.exp(eta.V1);
  const V2 = A.thetaV2 * f.fSize * Math.exp(eta.V2);
  const CL =
    A.thetaCL * Math.pow(V1 / A.thetaV1, 0.75) * f.fMat * f.fAge * f.fScr * (1 + cancer * A.thetaStdy10) * Math.exp(eta.CL);
  const Q = A.thetaQ * Math.pow(V2 / A.thetaV2, 0.75) * (1 - heel * A.thetaStdy13Q2);
  return { CL, V1, V2, Q, factors: f, formulation };
}

export function typicalParameters(cov: PediatricCovariates, formulation: Colin2019Formulation = "fitted_nonmem"): TypicalParameters {
  return individualParameters(cov, ETA_ZERO, formulation);
}

/**
 * Age conventions (docs/pediatric/AGE-CONVENTION.md).
 *
 * The model covariate PMA is in years. The source model mixes two year
 * lengths: its reference individual is PMA_R = 35 + 40/52 (a 35-year-old born
 * at 40 weeks; 1 year = 52 weeks), its Methods define PMA for non-neonates as
 * "40 weeks longer than the recorded postnatal age (years)", while the control
 * stream derives GA = (PMA*365 - PNA)/7 (1 year = 365 days). The preview uses
 * ONE convention everywhere:
 *
 *   PMA (years) = postnatal age (chronological years, 365.25 days)
 *               + gestational age at birth (weeks) / 52
 *
 * which reproduces PMA_R and the non-neonatal rule exactly and differs from
 * the neonatal clinical convention (GA + PNA/7 weeks, then /52) by at most
 * 0.33 days of PMA over the dataset's neonatal postnatal range (1-95 days),
 * and from the control-stream identity by at most 1 day for any child.
 */
export const DAYS_PER_YEAR = 365.25;
export const WEEKS_PER_MODEL_YEAR = 52;

/** Model postmenstrual age in years: PNA (chronological years) + GA/52. */
export function postmenstrualAgeYears(gestationalAgeWeeks: number, postnatalDays: number): number {
  return postnatalDays / DAYS_PER_YEAR + gestationalAgeWeeks / WEEKS_PER_MODEL_YEAR;
}

/** Clinical postmenstrual age in weeks (GA + completed postnatal days / 7), for display beside the model value. */
export function clinicalPostmenstrualAgeWeeks(gestationalAgeWeeks: number, postnatalDays: number): number {
  return gestationalAgeWeeks + postnatalDays / 7;
}
