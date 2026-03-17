/**
 * First-pass initial regimen calculation for Vancomyzer.
 * For new patients only; no existing regimen or measured levels.
 *
 * Uses the same centralized PK modules as the existing-regimen path:
 * - adult prior parameters from buildPriorParameters
 * - one-compartment steady-state exposure from steadyStateOneCompartment
 * - candidate simulation from simulateCandidateExposure
 *
 * This remains a prior-based first-pass estimate only; no posterior/Bayesian update.
 */

import { buildPriorParameters } from "./pk/posterior/buildPriorParameters";
import { simulateCandidateExposure } from "./pk/recommend/simulateCandidateExposure";
import { curvePoints } from "./pk/steadyStateOneCompartment";

interface Patient {
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;
}

export interface InitialRegimenResult {
  recommendation_type: "initial_regimen";
  auc24: number;
  peak: number;
  trough: number;
  recommended_dose: string;
  recommended_interval_hours: number;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: { time_hours: number; concentration: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  documentation_preview: {
    quick_summary: string;
    clinical_note: string;
  };
}

const TARGET_AUC24_LOW = 400;
const TARGET_AUC24_HIGH = 600;
const TARGET_AUC24_MID = 500;
const DOSE_OPTIONS_MG = [250, 500, 750, 1000, 1250, 1500, 1750, 2000];
const INTERVAL_OPTIONS_H = [8, 12, 24];
const DEFAULT_INFUSION_HOURS = 1;
const MAX_TDD_MG_PER_DAY = 4500;
const MAX_PEAK_MCG_ML = 80;
const MAX_TROUGH_MCG_ML = 25;

function chooseInitialCandidate(Ke: number, V: number): {
  dose_mg: number;
  interval_hours: number;
  auc24: number;
  peak: number;
  trough: number;
} {
  const candidates: {
    dose_mg: number;
    interval_hours: number;
    auc24: number;
    peak: number;
    trough: number;
    inRange: boolean;
  }[] = [];

  for (const interval_hours of INTERVAL_OPTIONS_H) {
    for (const dose_mg of DOSE_OPTIONS_MG) {
      const tdd = (dose_mg * 24) / interval_hours;
      if (tdd > MAX_TDD_MG_PER_DAY) continue;
      const exposure = simulateCandidateExposure(Ke, V, {
        dose_mg,
        interval_hours,
        infusion_duration_hours: Math.min(DEFAULT_INFUSION_HOURS, interval_hours),
      });
      if (exposure.peak > MAX_PEAK_MCG_ML || exposure.trough > MAX_TROUGH_MCG_ML) continue;
      candidates.push({
        dose_mg,
        interval_hours,
        auc24: exposure.auc24,
        peak: exposure.peak,
        trough: exposure.trough,
        inRange: exposure.auc24 >= TARGET_AUC24_LOW && exposure.auc24 <= TARGET_AUC24_HIGH,
      });
    }
  }

  const ranked = (candidates.some((c) => c.inRange) ? candidates.filter((c) => c.inRange) : candidates)
    .sort((a, b) => {
      const aucDelta = Math.abs(a.auc24 - TARGET_AUC24_MID) - Math.abs(b.auc24 - TARGET_AUC24_MID);
      if (aucDelta !== 0) return aucDelta;
      const dailyDoseA = (a.dose_mg * 24) / a.interval_hours;
      const dailyDoseB = (b.dose_mg * 24) / b.interval_hours;
      return dailyDoseA - dailyDoseB;
    });

  return ranked[0] ?? {
    dose_mg: 1000,
    interval_hours: 12,
    ...simulateCandidateExposure(Ke, V, {
      dose_mg: 1000,
      interval_hours: 12,
      infusion_duration_hours: 1,
    }),
  };
}

export function computeInitialRegimen(patient: Patient): InitialRegimenResult {
  const prior = buildPriorParameters(
    {
      age: patient.age,
      sex: patient.sex,
      height_cm: patient.height_cm,
      weight_kg: patient.weight_kg,
      serum_creatinine_mg_dl: patient.serum_creatinine_mg_dl,
    },
    {
      dose_mg: 1000,
      interval_hours: 12,
      infusion_duration_hours: DEFAULT_INFUSION_HOURS,
    }
  );

  const choice = chooseInitialCandidate(prior.Ke, prior.V);
  const curve = curvePoints(
    {
      Ke: prior.Ke,
      V: prior.V,
      dose_mg: choice.dose_mg,
      tau: choice.interval_hours,
      T_inf: Math.min(DEFAULT_INFUSION_HOURS, choice.interval_hours),
    },
    choice.interval_hours * 2,
    0.5
  );

  const recommended_dose = `${choice.dose_mg} mg`;
  const auc24 = Math.round(choice.auc24 * 10) / 10;
  const peak = Math.round(choice.peak * 10) / 10;
  const trough = Math.round(choice.trough * 10) / 10;

  const interpretation_summary =
    `Initial regimen suggestion: ${recommended_dose} every ${choice.interval_hours} hours. ` +
    `Prior-based first-pass estimate: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL. ` +
    `Estimated CrCl ${prior.crcl} mL/min. No measured levels; re-evaluate after levels are available. Intended to support review, not replace clinician judgment.`;

  const assumptions = [
    "Creatinine clearance estimated using Cockcroft-Gault with explicit adult weight selection (underweight: actual body weight; non-obese: ideal body weight; obese: adjusted body weight), using age, sex, height, weight, and serum creatinine.",
    "Adult prior model explicit in code: Ducharme 1994 clearance prior (CL = 0.771 × CrCl + 18.9 mL/min) with V prior = 0.69 L/kg ideal body weight.",
    "Initial regimen chosen from practical dose/interval candidates using the shared one-compartment steady-state PK model.",
    "No measured vancomycin levels; no posterior or Bayesian update.",
  ];

  const limitations = [
    "First-pass adult prior estimate only; no measured levels are available to individualize PK.",
    "Outputs are model-based prior predictions and should not be interpreted as patient-specific certainty.",
    "Clinical judgment, local protocols, and reassessment after levels remain essential.",
  ];

  const quick_summary = [
    `Initial regimen: ${recommended_dose} every ${choice.interval_hours} hours`,
    `Prior-based estimate: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL`,
    `Estimated CrCl: ${prior.crcl} mL/min. Assumptions and limitations apply.`,
  ].join("\n");

  const clinical_note = [
    "Vancomycin initial regimen suggestion (no levels).",
    `Dose: ${recommended_dose}; Interval: every ${choice.interval_hours} hours.`,
    `Prior-based estimate: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL.`,
    `Estimated CrCl: ${prior.crcl} mL/min (Cockcroft-Gault). Adult prior model: Ducharme 1994 CL-CrCl relationship with V = 0.69 L/kg ideal body weight.`,
    "Limitations: no measured levels; reassess when levels are available. Do not overinterpret prior-only outputs as patient-specific precision.",
  ].join("\n");

  return {
    recommendation_type: "initial_regimen",
    auc24,
    peak,
    trough,
    recommended_dose,
    recommended_interval_hours: choice.interval_hours,
    interpretation_summary,
    assumptions,
    limitations,
    curve,
    measured_levels: [],
    documentation_preview: {
      quick_summary,
      clinical_note,
    },
  };
}
