/**
 * First-pass initial regimen calculation for Vancomyzer.
 * For new patients only; no existing regimen or measured levels.
 */

import { buildPriorParameters } from "./pk/posterior/buildPriorParameters";
import { buildEmpiricLoadingDose } from "./pk/recommend/buildEmpiricLoadingDose";
import { simulateCandidateExposure } from "./pk/recommend/simulateCandidateExposure";
import { computeSafeInfusionDurationHours } from "./pk/recommend/infusionSafety";
import { curvePoints } from "./pk/steadyStateTwoCompartment";
import { buildInitialRegimenReviewStatus } from "./pk/response/buildReviewStatus";
import type { CalculationDetails, FrequencyOption } from "@/types/calculator";

interface Patient {
  age: number;
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
  recommended_infusion_duration_hours: number;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: { time_hours: number; concentration: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  calculation_details: CalculationDetails;
  frequency_options: FrequencyOption[];
  documentation_preview: {
    quick_summary: string;
    clinical_note: string;
  };
  pk_parameters: {
    CL: number;
    V1: number;
    Q: number;
    V2: number;
    used_posterior_refinement: boolean;
    scr: number;
    age: number;
    weight_kg: number;
  };
}

const TARGET_AUC24_LOW = 400;
const TARGET_AUC24_HIGH = 600;
const TARGET_AUC24_MID = 500;
const DOSE_OPTIONS_MG = [250, 500, 750, 1000, 1250, 1500, 1750, 2000];
const INTERVAL_OPTIONS_H = [8, 12, 24];
const DEFAULT_INFUSION_HOURS = 1;

// Max TDD safety cap based on SCr (Colin 2019 uses SCr directly as renal covariate)
// Higher SCr = worse renal function = lower max dose
function getMaxTdd(scr: number): number {
  if (scr >= 3.5) return 1000;  // severely impaired
  if (scr >= 2.0) return 2000;  // moderately impaired
  if (scr >= 1.3) return 3000;  // mildly impaired
  return 4500;                   // normal renal function
}

const MAX_PEAK_MCG_ML = 80;
const MAX_TROUGH_MCG_ML = 25;

function chooseInitialCandidate(CL: number, V1: number, Q: number, V2: number, scr: number) {
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
      if (tdd > getMaxTdd(scr)) continue;
      const exposure = simulateCandidateExposure(CL, V1, Q, V2, {
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

  const inRangeCandidates = candidates.filter((c) => c.inRange);
  const ranked = (inRangeCandidates.length > 0 ? inRangeCandidates : candidates).sort((a, b) => {
    const aucDelta = Math.abs(a.auc24 - TARGET_AUC24_MID) - Math.abs(b.auc24 - TARGET_AUC24_MID);
    if (aucDelta !== 0) return aucDelta;
    const dailyDoseA = (a.dose_mg * 24) / a.interval_hours;
    const dailyDoseB = (b.dose_mg * 24) / b.interval_hours;
    return dailyDoseA - dailyDoseB;
  });

  const best = ranked.length > 0 ? ranked[0] : {
    dose_mg: 1000,
    interval_hours: 12,
    auc24: simulateCandidateExposure(CL, V1, Q, V2, {
      dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1,
    }).auc24,
    peak: simulateCandidateExposure(CL, V1, Q, V2, {
      dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1,
    }).peak,
    trough: simulateCandidateExposure(CL, V1, Q, V2, {
      dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1,
    }).trough,
    inRange: false,
  };

  // Build frequency options: best candidate per interval
  const frequencyOptions = buildFrequencyOptions(candidates, best, CL, V1, Q, V2);

  return { best, frequencyOptions };
}

function buildFrequencyOptions(
  candidates: { dose_mg: number; interval_hours: number; auc24: number; peak: number; trough: number; inRange: boolean }[],
  recommended: { dose_mg: number; interval_hours: number },
  CL: number, V1: number, Q: number, V2: number
): FrequencyOption[] {
  const byInterval = new Map<number, typeof candidates>();
  for (const c of candidates) {
    if (!byInterval.has(c.interval_hours)) byInterval.set(c.interval_hours, []);
    byInterval.get(c.interval_hours)!.push(c);
  }

  const options: FrequencyOption[] = [];
  byInterval.forEach((group, interval) => {
    // Prefer in-range, then closest to AUC mid-target
    const sorted = [...group].sort((a, b) => {
      if (a.inRange !== b.inRange) return a.inRange ? -1 : 1;
      return Math.abs(a.auc24 - TARGET_AUC24_MID) - Math.abs(b.auc24 - TARGET_AUC24_MID);
    });
    const pick = sorted[0];
    const infusion = computeSafeInfusionDurationHours(pick.dose_mg);
    const T_inf = infusion.infusion_duration_hours;
    const optCurve = curvePoints(
      { CL, V1, Q, V2, dose_mg: pick.dose_mg, tau: interval, T_inf },
      0.25
    );
    options.push({
      dose_mg: pick.dose_mg,
      interval_hours: interval,
      auc24: Math.round(pick.auc24 * 10) / 10,
      peak: Math.round(pick.peak * 10) / 10,
      trough: Math.round(pick.trough * 10) / 10,
      infusion_duration_hours: T_inf,
      is_recommended: pick.dose_mg === recommended.dose_mg && interval === recommended.interval_hours,
      curve: optCurve,
    });
  });

  // Sort by interval ascending
  options.sort((a, b) => a.interval_hours - b.interval_hours);
  return options;
}

export function computeInitialRegimen(patient: Patient): InitialRegimenResult {
  const prior = buildPriorParameters(
    {
      age: patient.age,
      weight_kg: patient.weight_kg,
      serum_creatinine_mg_dl: patient.serum_creatinine_mg_dl,
    },
    {
      dose_mg: 1000,
      interval_hours: 12,
      infusion_duration_hours: DEFAULT_INFUSION_HOURS,
    }
  );

  const { best: choice, frequencyOptions } = chooseInitialCandidate(prior.CL, prior.V1, prior.Q, prior.V2, prior.scr);
  const safeInfusion = computeSafeInfusionDurationHours(choice.dose_mg);
  const loadingDose = buildEmpiricLoadingDose({ actual_body_weight_kg: patient.weight_kg });
  const curve = curvePoints(
    {
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      dose_mg: choice.dose_mg,
      tau: choice.interval_hours,
      T_inf: Math.min(safeInfusion.infusion_duration_hours, choice.interval_hours),
    }
  );

  const recommended_dose = `${choice.dose_mg} mg`;
  const auc24 = Math.round(choice.auc24 * 10) / 10;
  const peak = Math.round(choice.peak * 10) / 10;
  const trough = Math.round(choice.trough * 10) / 10;

  const interpretation_summary =
    `Initial regimen suggestion: ${recommended_dose} every ${choice.interval_hours} hours infused over ${safeInfusion.infusion_duration_hours} hours. ` +
    `Prior-based first-pass estimate: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL. ` +
    `SCr ${prior.scr} mg/dL (Colin 2019 direct renal covariate). If immediate severe-infection coverage is clinically necessary under local practice, a clinician may optionally consider an empiric loading-dose estimate around ${loadingDose.suggested_dose_mg} mg (${loadingDose.basis}) before maintenance dosing. ` +
    `${safeInfusion.safety_note ? `${safeInfusion.safety_note} ` : ""}` +
    `No measured levels; re-evaluate after levels are available. Intended to support review, not replace clinician judgment.`;

  const assumptions = [
    "Serum creatinine (SCr) is used directly as the renal covariate in the Colin 2019 model — Cockcroft-Gault CrCl estimation is NOT used. CL scales with (0.83/SCr)^0.80 per the Colin 2019 published equations.",
    "Adult prior model explicit in code: Colin 2019 two-compartment population prior.",
    "Initial regimen chosen from practical dose/interval candidates using the shared two-compartment steady-state PK model.",
    "Infusion duration constrained to a minimum of 60 minutes and a maximum rate of 10 mg/min in line with FDA labeling and guideline-based safety framing.",
    "Empiric loading-dose note, when shown, is a capped actual-body-weight estimate for clinician consideration and does not encode severity, indication, or critical-illness context.",
    "No measured vancomycin levels; no posterior or Bayesian update.",
  ];

  const limitations = [
    "First-pass adult prior estimate only; no measured levels are available to individualize PK.",
    "Outputs are model-based prior predictions and should not be interpreted as patient-specific certainty.",
    "Any loading-dose note is optional generic empiric support only and should not replace clinician judgment about infection severity, critical illness, low body weight, or institutional protocol.",
    "Adult concentration limits (for example, dilution ≤5 mg/mL) were not enforced because infusion volume is not entered in this workflow.",
    "Clinical judgment, local protocols, and reassessment after levels remain essential.",
  ];

  const quick_summary = [
    `Initial regimen: ${recommended_dose} every ${choice.interval_hours} hours infused over ${safeInfusion.infusion_duration_hours} hours`,
    `Prior-based estimate: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL`,
    ...(safeInfusion.safety_note ? [safeInfusion.safety_note] : []),
    `SCr: ${prior.scr} mg/dL (direct Colin 2019 covariate). Loading-dose considerations are optional, generic empiric support only, and should be reviewed separately from the maintenance suggestion. Assumptions and limitations apply.`,
  ].join("\n");

  const clinical_note = [
    "Vancomycin initial regimen suggestion (no levels).",
    `Dose: ${recommended_dose}; Interval: every ${choice.interval_hours} hours; Infusion: ${safeInfusion.infusion_duration_hours} hours.`,
    `Prior-based estimate: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL.`,
    ...(safeInfusion.safety_note ? [safeInfusion.safety_note] : []),
    `SCr: ${prior.scr} mg/dL (Colin 2019 direct renal covariate — Cockcroft-Gault not used). Adult prior model: Colin 2019 two-compartment population prior.`,
    `If rapid empiric attainment is clinically necessary under local practice, an optional actual-body-weight loading-dose estimate around ${loadingDose.suggested_dose_mg} mg may be considered (${loadingDose.basis}).`,
    "Limitations: no measured levels; reassess when levels are available. Do not overinterpret prior-only outputs as patient-specific precision.",
  ].join("\n");

  const review_status = buildInitialRegimenReviewStatus();

  return {
    recommendation_type: "initial_regimen",
    auc24,
    peak,
    trough,
    recommended_dose,
    recommended_interval_hours: choice.interval_hours,
    recommended_infusion_duration_hours: safeInfusion.infusion_duration_hours,
    infusion_duration_adjusted_for_safety: safeInfusion.adjusted_for_safety,
    infusion_safety_note: safeInfusion.safety_note,
    interpretation_summary,
    assumptions,
    limitations,
    curve,
    measured_levels: [],
    frequency_options: frequencyOptions,
    calculation_details: {
      method: "Adult prior model only in a two-compartment intermittent steady-state maintenance-selection workflow",
      evidence_strength: "population prior only",
      data_quality_summary: "No measured levels entered; workflow fit depends on population-prior assumptions and patient-characteristic inputs only.",
      review_status,
      key_inputs: [
        `SCr ${prior.scr} mg/dL (Colin 2019 direct renal covariate)`,
        `Weight ${patient.weight_kg} kg`,
        `Safety infusion duration ${safeInfusion.infusion_duration_hours} h`,
      ],
      caution_flags: [
        "No posterior refinement from measured levels was applied.",
        "Loading-dose language is optional generic empiric support, not patient-specific severity logic.",
        "Review assumptions, scope exclusions, and local protocol before acting.",
      ],
    },
    documentation_preview: {
      quick_summary,
      clinical_note,
    },
    pk_parameters: {
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      used_posterior_refinement: false,
      scr: prior.scr,
      age: patient.age,
      weight_kg: patient.weight_kg,
    },
  };
}
