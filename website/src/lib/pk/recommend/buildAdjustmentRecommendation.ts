import type { ExistingRegimenEngineOutput } from "../types";
import type { AdjustmentRecommendation } from "../types";
import { simulateCandidateExposure } from "./simulateCandidateExposure";

const TARGET_AUC24_LOW = 400;
const TARGET_AUC24_HIGH = 600;
const TARGET_AUC24_MID = 500;

/** Practical dose options (mg). */
const DOSE_OPTIONS_MG = [250, 500, 750, 1000, 1250, 1500, 1750, 2000];

/** Practical interval options (hours), expanded but still bounded. */
const INTERVAL_OPTIONS_H = [6, 8, 12, 18, 24, 36, 48];

/** Max total daily dose (mg/day) considered reasonable. */
const MAX_TDD_MG_PER_DAY = 4500;

/** Max peak (mcg/mL) for a candidate to be accepted. */
const MAX_PEAK_MCG_ML = 80;

/** Max trough (mcg/mL) for a candidate to be accepted. */
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

function conservativeSameIntervalDose(
  currentDoseMg: number,
  currentIntervalHours: number,
  auc24: number
): AdjustmentRecommendation {
  const recommended_dose_mg = Math.min(
    2000,
    roundDoseMg(Math.max(250, (currentDoseMg * TARGET_AUC24_MID) / Math.max(auc24, 1)))
  );
  const tdd = (recommended_dose_mg * 24) / currentIntervalHours;
  const dose_mg =
    tdd > MAX_TDD_MG_PER_DAY
      ? roundDoseMg((MAX_TDD_MG_PER_DAY * currentIntervalHours) / 24)
      : recommended_dose_mg;
  return {
    recommended_dose: `${Math.max(250, dose_mg)} mg`,
    recommended_interval_hours: currentIntervalHours,
  };
}

export function buildAdjustmentRecommendation(
  output: ExistingRegimenEngineOutput
): AdjustmentRecommendation {
  const {
    auc24,
    current_regimen_dose_mg,
    current_regimen_interval_hours,
    Ke,
    V,
    current_regimen_infusion_hours,
  } = output;

  const infusion_hours = current_regimen_infusion_hours ?? 1;

  if (Ke == null || V == null || Ke <= 0 || V <= 0) {
    return conservativeSameIntervalDose(
      current_regimen_dose_mg,
      current_regimen_interval_hours,
      auc24
    );
  }

  const candidates: CandidateScore[] = [];
  for (const interval_hours of INTERVAL_OPTIONS_H) {
    for (const dose_mg of DOSE_OPTIONS_MG) {
      const dailyDose = (dose_mg * 24) / interval_hours;
      if (dailyDose > MAX_TDD_MG_PER_DAY) continue;
      const exp = simulateCandidateExposure(Ke, V, {
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

  const inRangeCandidates = candidates.filter(
    (candidate) => candidate.auc24 >= TARGET_AUC24_LOW && candidate.auc24 <= TARGET_AUC24_HIGH
  );

  if (inRangeCandidates.length > 0) {
    inRangeCandidates.sort((a, b) => {
      const aucDelta = Math.abs(a.auc24 - TARGET_AUC24_MID) - Math.abs(b.auc24 - TARGET_AUC24_MID);
      if (aucDelta !== 0) return aucDelta;
      if (a.sameInterval !== b.sameInterval) return a.sameInterval ? -1 : 1;
      if (a.intervalDistance !== b.intervalDistance) return a.intervalDistance - b.intervalDistance;
      return a.dailyDose - b.dailyDose;
    });
    return {
      recommended_dose: `${inRangeCandidates[0].dose_mg} mg`,
      recommended_interval_hours: inRangeCandidates[0].interval_hours,
    };
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const aPenalty = Math.abs(a.auc24 - TARGET_AUC24_MID);
      const bPenalty = Math.abs(b.auc24 - TARGET_AUC24_MID);
      if (aPenalty !== bPenalty) return aPenalty - bPenalty;
      const aSafetyPenalty = Math.max(0, a.trough - 20) + Math.max(0, a.peak - 40) * 0.25;
      const bSafetyPenalty = Math.max(0, b.trough - 20) + Math.max(0, b.peak - 40) * 0.25;
      if (aSafetyPenalty !== bSafetyPenalty) return aSafetyPenalty - bSafetyPenalty;
      if (a.sameInterval !== b.sameInterval) return a.sameInterval ? -1 : 1;
      if (a.intervalDistance !== b.intervalDistance) return a.intervalDistance - b.intervalDistance;
      return a.dailyDose - b.dailyDose;
    });
    return {
      recommended_dose: `${candidates[0].dose_mg} mg`,
      recommended_interval_hours: candidates[0].interval_hours,
    };
  }

  if (auc24 > 0) {
    return conservativeSameIntervalDose(
      current_regimen_dose_mg,
      current_regimen_interval_hours,
      auc24
    );
  }

  return {
    recommended_dose: `${current_regimen_dose_mg} mg`,
    recommended_interval_hours: current_regimen_interval_hours,
  };
}
