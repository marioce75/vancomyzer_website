import type { ExistingRegimenEngineOutput, AdjustmentRecommendation, FrequencyOption } from "../types";
import { simulateCandidateExposure } from "./simulateCandidateExposure";
import { computeSafeInfusionDurationHours } from "./infusionSafety";
import { curvePoints, loadingDoseCurvePoints } from "../steadyStateTwoCompartment";

const TARGET_AUC24_LOW = 400;
const TARGET_AUC24_HIGH = 600;
const TARGET_AUC24_MID = 500;

const DOSE_OPTIONS_MG = [250, 500, 750, 1000, 1250, 1500, 1750, 2000];
const INTERVAL_OPTIONS_H = [6, 8, 12, 18, 24, 36, 48];
const MAX_TDD_MG_PER_DAY = 4500;
const MAX_PEAK_MCG_ML = 80;
const MAX_TROUGH_MCG_ML = 25;

function roundDoseMg(mg: number): number {
  const rounded = Math.round(mg / 250) * 250;
  if (rounded < 250) return 250;
  if (rounded > 2000) return 2000;
  return rounded;
}

interface CandidateScore {
  dose_mg: number;
  interval_hours: number;
  auc24: number;
  peak: number;
  trough: number;
  sameInterval: boolean;
  intervalDistance: number;
  dailyDose: number;
}

function finalizeRecommendation(
  dose_mg: number,
  interval_hours: number,
  requested_infusion_hours?: number | null
): AdjustmentRecommendation {
  const infusion = computeSafeInfusionDurationHours(dose_mg, requested_infusion_hours);
  return {
    recommended_dose: `${dose_mg} mg`,
    recommended_interval_hours: interval_hours,
    recommended_infusion_duration_hours: infusion.infusion_duration_hours,
    infusion_duration_adjusted_for_safety: infusion.adjusted_for_safety,
    infusion_safety_note: infusion.safety_note,
  };
}

function isClearlySupraTherapeuticSparseCase(output: ExistingRegimenEngineOutput): boolean {
  return output.level_count <= 1 && (output.auc24 >= 650 || output.trough >= 20 || output.peak >= 45);
}

function conservativeSameIntervalDose(
  currentDoseMg: number,
  currentIntervalHours: number,
  auc24: number,
  requestedInfusionHours?: number | null
): AdjustmentRecommendation {
  const recommended_dose_mg = Math.min(2000, roundDoseMg(Math.max(250, (currentDoseMg * TARGET_AUC24_MID) / Math.max(auc24, 1))));
  const tdd = (recommended_dose_mg * 24) / currentIntervalHours;
  const dose_mg = tdd > MAX_TDD_MG_PER_DAY ? roundDoseMg((MAX_TDD_MG_PER_DAY * currentIntervalHours) / 24) : recommended_dose_mg;
  return finalizeRecommendation(Math.max(250, dose_mg), currentIntervalHours, requestedInfusionHours);
}

function boundedSparseHighExposureRecommendation(output: ExistingRegimenEngineOutput): AdjustmentRecommendation | null {
  const { CL, V1, Q, V2, auc24, current_regimen_dose_mg, current_regimen_interval_hours, current_regimen_infusion_hours } = output;
  if (CL == null || V1 == null || Q == null || V2 == null || CL <= 0 || V1 <= 0 || Q <= 0 || V2 <= 0) return null;

  const infusion_hours = current_regimen_infusion_hours ?? 1;
  const nextLongerInterval = INTERVAL_OPTIONS_H.find((interval) => interval > current_regimen_interval_hours);

  if (nextLongerInterval != null && current_regimen_interval_hours <= 8) {
    const scaledDose = roundDoseMg(Math.max(250, (current_regimen_dose_mg * TARGET_AUC24_MID) / Math.max(auc24, 1)));
    const heuristicDose = roundDoseMg(Math.max(scaledDose, current_regimen_dose_mg * 0.5));
    const heuristicExposure = simulateCandidateExposure(CL, V1, Q, V2, {
      dose_mg: heuristicDose,
      interval_hours: nextLongerInterval,
      infusion_duration_hours: Math.min(infusion_hours, nextLongerInterval),
    });

    if (
      heuristicExposure.peak <= MAX_PEAK_MCG_ML &&
      heuristicExposure.trough <= MAX_TROUGH_MCG_ML &&
      heuristicExposure.auc24 <= Math.max(TARGET_AUC24_HIGH + 50, auc24 * 0.8)
    ) {
      return finalizeRecommendation(heuristicDose, nextLongerInterval, infusion_hours);
    }
  }

  const currentDoseRounded = roundDoseMg(current_regimen_dose_mg);
  const intervalOptions = INTERVAL_OPTIONS_H.filter((interval) => interval >= current_regimen_interval_hours);
  const doseOptions = Array.from(new Set([currentDoseRounded, roundDoseMg(current_regimen_dose_mg * 0.75), roundDoseMg(current_regimen_dose_mg * 0.5)]));

  const candidates: CandidateScore[] = [];
  for (const interval_hours of intervalOptions) {
    for (const dose_mg of doseOptions) {
      const dailyDose = (dose_mg * 24) / interval_hours;
      if (dailyDose > MAX_TDD_MG_PER_DAY) continue;
      const exp = simulateCandidateExposure(CL, V1, Q, V2, {
        dose_mg,
        interval_hours,
        infusion_duration_hours: Math.min(infusion_hours, interval_hours),
      });
      if (exp.peak > MAX_PEAK_MCG_ML || exp.trough > MAX_TROUGH_MCG_ML) continue;
      candidates.push({
        dose_mg,
        interval_hours,
        auc24: exp.auc24,
        peak: exp.peak,
        trough: exp.trough,
        sameInterval: interval_hours === current_regimen_interval_hours,
        intervalDistance: Math.abs(interval_hours - current_regimen_interval_hours),
        dailyDose,
      });
    }
  }

  const saferCandidates = candidates.filter((candidate) => candidate.auc24 <= TARGET_AUC24_HIGH && candidate.trough <= 20);
  const ranked = (saferCandidates.length > 0 ? saferCandidates : candidates).sort((a, b) => {
    const aPenalty = Math.abs(a.auc24 - TARGET_AUC24_MID) + Math.max(0, a.trough - 15) * 8;
    const bPenalty = Math.abs(b.auc24 - TARGET_AUC24_MID) + Math.max(0, b.trough - 15) * 8;
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
    if (a.interval_hours !== b.interval_hours) return a.interval_hours - b.interval_hours;
    return a.dailyDose - b.dailyDose;
  });

  if (ranked.length === 0) return null;
  return finalizeRecommendation(ranked[0].dose_mg, ranked[0].interval_hours, infusion_hours);
}

function collectFrequencyOptions(
  CL: number, V1: number, Q: number, V2: number,
  infusion_hours: number,
  recommended: { dose_mg: number; interval_hours: number },
  targetAucMid: number = TARGET_AUC24_MID,
  loadingDose?: { dose_mg: number; T_inf: number }
): FrequencyOption[] {
  const allCandidates: { dose_mg: number; interval_hours: number; auc24: number; peak: number; trough: number; inRange: boolean }[] = [];

  for (const interval_hours of INTERVAL_OPTIONS_H) {
    for (const dose_mg of DOSE_OPTIONS_MG) {
      const dailyDose = (dose_mg * 24) / interval_hours;
      if (dailyDose > MAX_TDD_MG_PER_DAY) continue;
      const exp = simulateCandidateExposure(CL, V1, Q, V2, {
        dose_mg,
        interval_hours,
        infusion_duration_hours: Math.min(infusion_hours, interval_hours),
      });
      if (exp.peak > MAX_PEAK_MCG_ML || exp.trough > MAX_TROUGH_MCG_ML) continue;
      allCandidates.push({
        dose_mg,
        interval_hours,
        auc24: exp.auc24,
        peak: exp.peak,
        trough: exp.trough,
        inRange: exp.auc24 >= TARGET_AUC24_LOW && exp.auc24 <= TARGET_AUC24_HIGH,
      });
    }
  }

  const byInterval = new Map<number, typeof allCandidates>();
  for (const c of allCandidates) {
    if (!byInterval.has(c.interval_hours)) byInterval.set(c.interval_hours, []);
    byInterval.get(c.interval_hours)!.push(c);
  }

  const options: FrequencyOption[] = [];
  byInterval.forEach((group, interval) => {
    const sorted = [...group].sort((a, b) => {
      if (a.inRange !== b.inRange) return a.inRange ? -1 : 1;
      return Math.abs(a.auc24 - targetAucMid) - Math.abs(b.auc24 - targetAucMid);
    });
    const pick = sorted[0];
    // Only emit options where the best available dose lands in the therapeutic window.
    // ASHP/IDSA/SIDP 2020: AUC24 target 400–600 mg·h/L. Never display out-of-range options.
    if (!pick.inRange) return;
    const infusion = computeSafeInfusionDurationHours(pick.dose_mg);
    const T_inf = infusion.infusion_duration_hours;
    const optCurve = loadingDose
      ? loadingDoseCurvePoints(
          { CL, V1, Q, V2 },
          loadingDose.dose_mg, loadingDose.T_inf,
          pick.dose_mg, interval, T_inf,
          0.25
        )
      : curvePoints(
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

  options.sort((a, b) => a.interval_hours - b.interval_hours);
  return options;
}

export function buildAdjustmentRecommendation(output: ExistingRegimenEngineOutput): AdjustmentRecommendation {
  const { auc24, current_regimen_dose_mg, current_regimen_interval_hours, CL, V1, Q, V2, current_regimen_infusion_hours, posterior_fit, level_count, doses_given, target_auc24 } = output;
  const infusion_hours = current_regimen_infusion_hours ?? 1;
  const isPulseDose = doses_given === 1;
  // For pulse dose, target the user-specified AUC₂₄ (default 450 per ASHP guidelines for initial dosing)
  const targetAucMid = isPulseDose ? (target_auc24 ?? 450) : TARGET_AUC24_MID;
  const weakEvidenceRecommendation =
    posterior_fit?.fit_quality === "weak" ||
    posterior_fit?.uncertainty_label === "high" ||
    posterior_fit?.fit_quality === "prior_only" ||
    level_count <= 1;

  const hasPK = CL != null && V1 != null && Q != null && V2 != null && CL > 0 && V1 > 0 && Q > 0 && V2 > 0;

  if (!hasPK) {
    return conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours);
  }

  let base: AdjustmentRecommendation;

  if (!isPulseDose && weakEvidenceRecommendation) {
    if (isClearlySupraTherapeuticSparseCase(output)) {
      base = boundedSparseHighExposureRecommendation(output) ?? conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours);
    } else {
      base = conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours);
    }
  } else {
    const candidates: CandidateScore[] = [];
    for (const interval_hours of INTERVAL_OPTIONS_H) {
      for (const dose_mg of DOSE_OPTIONS_MG) {
        const dailyDose = (dose_mg * 24) / interval_hours;
        if (dailyDose > MAX_TDD_MG_PER_DAY) continue;
        const exp = simulateCandidateExposure(CL, V1, Q, V2, {
          dose_mg,
          interval_hours,
          infusion_duration_hours: Math.min(infusion_hours, interval_hours),
        });
        if (exp.peak > MAX_PEAK_MCG_ML || exp.trough > MAX_TROUGH_MCG_ML) continue;
        candidates.push({
          dose_mg,
          interval_hours,
          auc24: exp.auc24,
          peak: exp.peak,
          trough: exp.trough,
          sameInterval: interval_hours === current_regimen_interval_hours,
          intervalDistance: Math.abs(interval_hours - current_regimen_interval_hours),
          dailyDose,
        });
      }
    }

    const inRangeCandidates = candidates.filter((candidate) => candidate.auc24 >= TARGET_AUC24_LOW && candidate.auc24 <= TARGET_AUC24_HIGH);
    if (inRangeCandidates.length > 0) {
      inRangeCandidates.sort((a, b) => {
        const aucDelta = Math.abs(a.auc24 - targetAucMid) - Math.abs(b.auc24 - targetAucMid);
        if (aucDelta !== 0) return aucDelta;
        // For pulse dose, no current interval to prefer — rank by shorter interval for convenience
        if (!isPulseDose) {
          if (a.sameInterval !== b.sameInterval) return a.sameInterval ? -1 : 1;
          if (a.intervalDistance !== b.intervalDistance) return a.intervalDistance - b.intervalDistance;
        } else {
          if (a.interval_hours !== b.interval_hours) return a.interval_hours - b.interval_hours;
        }
        return a.dailyDose - b.dailyDose;
      });
      base = finalizeRecommendation(inRangeCandidates[0].dose_mg, inRangeCandidates[0].interval_hours, infusion_hours);
    } else if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const aPenalty = Math.abs(a.auc24 - targetAucMid);
        const bPenalty = Math.abs(b.auc24 - targetAucMid);
        if (aPenalty !== bPenalty) return aPenalty - bPenalty;
        const aSafetyPenalty = Math.max(0, a.trough - 20) + Math.max(0, a.peak - 40) * 0.25;
        const bSafetyPenalty = Math.max(0, b.trough - 20) + Math.max(0, b.peak - 40) * 0.25;
        if (aSafetyPenalty !== bSafetyPenalty) return aSafetyPenalty - bSafetyPenalty;
        if (!isPulseDose) {
          if (a.sameInterval !== b.sameInterval) return a.sameInterval ? -1 : 1;
          if (a.intervalDistance !== b.intervalDistance) return a.intervalDistance - b.intervalDistance;
        } else {
          if (a.interval_hours !== b.interval_hours) return a.interval_hours - b.interval_hours;
        }
        return a.dailyDose - b.dailyDose;
      });
      base = finalizeRecommendation(candidates[0].dose_mg, candidates[0].interval_hours, infusion_hours);
    } else if (auc24 > 0) {
      base = conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours);
    } else {
      base = finalizeRecommendation(current_regimen_dose_mg, current_regimen_interval_hours, current_regimen_infusion_hours);
    }
  }

  // ─── POST-RECOMMENDATION SAFETY CHECK ──────────────────────────────
  // Every code path above CAN emit a recommendation whose predicted
  // peak/trough exceeds the institutional safety caps — especially
  // conservativeSameIntervalDose, which scales by AUC ratio but doesn't
  // simulate the actual exposure. For severe renal impairment + short
  // current interval, the floor dose (250 or 500 mg) at the user's
  // current interval can still produce peaks of 150+ mcg/mL.
  //
  // Verify the recommendation before returning it. If unsafe, refuse
  // with adjustment_dosing_blocked rather than silently shipping a
  // dangerous regimen. This mirrors the empiric_dosing_blocked pattern
  // in initialRegimen.ts.
  if (hasPK) {
    const recDoseCheck = Number.parseFloat(base.recommended_dose);
    const recIntervalCheck = base.recommended_interval_hours;
    const recInfusionCheck = base.recommended_infusion_duration_hours ?? infusion_hours;
    if (Number.isFinite(recDoseCheck) && recDoseCheck > 0 && recIntervalCheck > 0) {
      const recExposure = simulateCandidateExposure(CL!, V1!, Q!, V2!, {
        dose_mg: recDoseCheck,
        interval_hours: recIntervalCheck,
        infusion_duration_hours: Math.min(recInfusionCheck, recIntervalCheck),
      });
      if (recExposure.peak > MAX_PEAK_MCG_ML || recExposure.trough > MAX_TROUGH_MCG_ML) {
        // The recommendation engine could not find a safe regimen in its
        // search space. Refuse and direct the clinician to hold dosing
        // and re-check the level.
        base = buildAdjustmentRefusal({
          CL: CL!,
          recommendedDoseCheck: recDoseCheck,
          recommendedInterval: recIntervalCheck,
          predictedPeak: recExposure.peak,
          predictedTrough: recExposure.trough,
          predictedAuc24: recExposure.auc24,
        });
      }
    }
  }

  // Attach frequency options from the full candidate grid
  const recDose = Number.parseFloat(base.recommended_dose);
  base.frequency_options = collectFrequencyOptions(
    CL, V1, Q, V2, infusion_hours,
    { dose_mg: Number.isFinite(recDose) ? recDose : current_regimen_dose_mg, interval_hours: base.recommended_interval_hours },
    targetAucMid,
    isPulseDose ? { dose_mg: current_regimen_dose_mg, T_inf: Math.min(infusion_hours, current_regimen_interval_hours) } : undefined
  );

  return base;
}

/**
 * Build the AdjustmentRecommendation emitted when the recommendation
 * engine cannot find a regimen whose predicted peak/trough fall within
 * the institutional safety caps. Mirrors initialRegimen.ts's empiric
 * refusal pattern: sentinel-safe values for the standard fields plus an
 * adjustment_dosing_blocked field that the UI uses to render the safety
 * state.
 */
function buildAdjustmentRefusal(args: {
  CL: number;
  recommendedDoseCheck: number;
  recommendedInterval: number;
  predictedPeak: number;
  predictedTrough: number;
  predictedAuc24: number;
}): AdjustmentRecommendation {
  const { CL, recommendedDoseCheck, recommendedInterval, predictedPeak, predictedTrough, predictedAuc24 } = args;
  const safetyMessage =
    `No safe maintenance regimen exists in the search space for this patient. ` +
    `Estimated clearance is ${CL.toFixed(2)} L/h — at the calculator's minimum dose ` +
    `(${recommendedDoseCheck} mg q${recommendedInterval}h, the lowest feasible at the ` +
    `current interval) the predicted steady-state peak would be ` +
    `${predictedPeak.toFixed(0)} mcg/mL and trough ${predictedTrough.toFixed(0)} mcg/mL ` +
    `(AUC₂₄ ${predictedAuc24.toFixed(0)} mg·h/L), all above the institutional safety caps. ` +
    `Recommended action: hold maintenance dosing, recheck a vancomycin level when ` +
    `the trough falls below 15–20 mcg/mL, then redose using the 1-Level workflow ` +
    `for level-guided pulse dosing.`;

  return {
    recommended_dose: "—",
    recommended_interval_hours: 0,
    recommended_infusion_duration_hours: 0,
    frequency_options: [],
    adjustment_dosing_blocked: {
      reason: `No regimen in the search grid satisfies peak ≤ ${MAX_PEAK_MCG_ML} mcg/mL and trough ≤ ${MAX_TROUGH_MCG_ML} mcg/mL at estimated CL ${CL.toFixed(2)} L/h.`,
      recommended_action: `Hold maintenance dosing; recheck level when trough < 15–20 mcg/mL; redose via 1-Level workflow.`,
      safety_message: safetyMessage,
      estimated_cl_l_h: Math.round(CL * 100) / 100,
    },
  };
}
