/**
 * Synthetic ICU patient generator — demographics matched to the
 * inclusion cohort of Bai et al. 2025 (the predictive-performance
 * paper that motivates this whole validation harness).
 *
 * Source for the target distributions:
 *   Bai G, Qi H, Huang Y, et al. "Predictive Performance of Bayesian
 *   Dosing Software for Vancomycin in Intensive Care Unit Patients."
 *   Ther Drug Monit. 2025;47:594–602. — Table 2.
 *
 *     Age          mean 61.71  SD 14.78
 *     Male         63.12 %
 *     Weight       median 65    IQR 56.5–75.0  kg
 *     Height       median 170   IQR 160–174    cm
 *     SCr          median 58    IQR 46–77      μmol/L  (=0.66 mg/dL median)
 *     BMI          median 24.0  IQR 21.44–26.32
 *
 * Excluded by Bai (and therefore by us): RRT, ECMO, HD, ages <18.
 *
 * Implementation notes:
 *   - Age is sampled normal, clamped to [18, 95].
 *   - Weight is sampled log-normal calibrated so the 50/25/75
 *     percentiles roughly match the target IQR. Same for SCr.
 *   - Height is sampled normal (per CDC adult tables, low BSV).
 *   - CrCl is then derived via Cockcroft–Gault — same path most
 *     Bayesian engines use, so the "truth" sampling and the
 *     downstream prior consume the same CrCl number.
 *   - We do NOT enforce a BMI floor: underweight and obese patients
 *     are realistic ICU presentations and the harness should be
 *     stressed across that range.
 *
 * Strictly synthetic — no PHI, no real patient data, no IRB needed.
 */

import type { Rng } from "./rng";

export interface SyntheticPatient {
  age_yr: number;
  sex: "male" | "female";
  weight_kg: number;
  height_cm: number;
  scr_mg_dl: number;
  /** Cockcroft–Gault, capped at [5, 200] mL/min. */
  crcl_ml_min: number;
}

/** Cockcroft–Gault CrCl (mL/min). Mirrors the path most Bayesian
 *  engines use for the prior — including PrecisePK/Goti. */
function cockcroftGault(p: { age_yr: number; weight_kg: number; sex: "male" | "female"; scr_mg_dl: number }): number {
  const numerator = (140 - p.age_yr) * p.weight_kg;
  const denominator = 72 * p.scr_mg_dl;
  const crcl = (numerator / denominator) * (p.sex === "female" ? 0.85 : 1.0);
  return Math.max(5, Math.min(200, crcl));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function sampleSyntheticIcuPatient(rng: Rng): SyntheticPatient {
  // Age — normal, clamped to adult ICU range.
  const age_yr = clamp(61.71 + 14.78 * rng.normal(), 18, 95);

  // Sex — 63.12% male per Bai Table 2.
  const sex: "male" | "female" = rng.next() < 0.6312 ? "male" : "female";

  // Weight (kg) — log-normal calibrated to median 65, IQR 56.5–75.
  //   ln(75/56.5) ≈ 0.283 ≈ 1.349 × sigma   →   sigma ≈ 0.210
  //   median exp(mu) = 65   →   mu = ln(65) ≈ 4.174
  const weight_kg = clamp(Math.exp(4.174 + 0.210 * rng.normal()), 35, 160);

  // Height (cm) — normal, sex-adjusted; SDs from CDC adult anthropometrics.
  //   Male: 175 ± 7   Female: 162 ± 7
  const height_cm = clamp((sex === "male" ? 175 : 162) + 7 * rng.normal(), 140, 200);

  // Serum creatinine (mg/dL) — log-normal calibrated to Bai's IQR.
  //   58 μmol/L = 0.656 mg/dL median; 46→0.520, 77→0.871; ratio ln(0.871/0.520)/1.349 ≈ 0.382
  const scr_mg_dl = clamp(Math.exp(Math.log(0.656) + 0.382 * rng.normal()), 0.3, 5.0);

  const crcl_ml_min = cockcroftGault({ age_yr, weight_kg, sex, scr_mg_dl });

  return { age_yr, sex, weight_kg, height_cm, scr_mg_dl, crcl_ml_min };
}

/** Generate N patients deterministically from a seeded RNG. */
export function sampleCohort(rng: Rng, n: number): SyntheticPatient[] {
  const out: SyntheticPatient[] = [];
  for (let i = 0; i < n; i++) out.push(sampleSyntheticIcuPatient(rng));
  return out;
}
