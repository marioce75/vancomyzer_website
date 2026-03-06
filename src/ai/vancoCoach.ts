/**
 * Vanco Coach — rule-based clinical assistant for vancomycin dosing.
 * Analyzes patient profile and PK outputs to generate warnings and suggestions.
 */

export type PatientProfileInput = {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  serumCreatinine: number;
  crclMlMin: number | null;
  ibw: number | null;
  abw: number | null;
};

export type DosingContext = {
  doseMg: number;
  intervalHr: number;
  infusionHr: number;
  auc24: number | null;
  predictedPeak: number | null;
  predictedTrough: number | null;
  mode: "basic" | "bayesian";
};

export type SerumLevelInput = {
  concentration: number;
  timeHours: number;
  levelType?: "peak" | "trough" | "other";
  doseTimeHours?: number;
};

export type CoachSuggestion = {
  severity: "warning" | "info" | "error";
  message: string;
};

const AUC_SAFE_LOW = 350;
const AUC_SAFE_HIGH = 650;
const AUC_TARGET_LOW = 400;
const AUC_TARGET_HIGH = 600;
const PEAK_MAX = 50;
const CRCL_EXTREME_LOW = 20;
const STEADY_STATE_MULTIPLE = 3; // ~3 half-lives to steady state

export function analyzePatientProfile(
  patient: PatientProfileInput,
  dosing: DosingContext
): CoachSuggestion[] {
  const out: CoachSuggestion[] = [];

  if (patient.crclMlMin != null && patient.crclMlMin < CRCL_EXTREME_LOW && dosing.mode === "basic") {
    out.push({
      severity: "warning",
      message: "Consider extended interval or renal dosing: CrCl < 20 mL/min with standard dosing may accumulate.",
    });
  }

  if (patient.crclMlMin != null && patient.crclMlMin < 30) {
    out.push({
      severity: "info",
      message: "Consider extended interval due to CrCl < 30 mL/min.",
    });
  }

  if (dosing.auc24 != null) {
    if (dosing.auc24 > AUC_SAFE_HIGH) {
      out.push({
        severity: "error",
        message: "Current regimen likely produces AUC > 650. Risk of nephrotoxicity. Consider reducing dose or extending interval.",
      });
    } else if (dosing.auc24 > AUC_TARGET_HIGH) {
      out.push({
        severity: "warning",
        message: "AUC above target range (400–600). Consider dose reduction or longer interval.",
      });
    } else if (dosing.auc24 < AUC_SAFE_LOW) {
      out.push({
        severity: "error",
        message: "AUC below 350 may be subtherapeutic for serious infections. Consider dose increase or shorter interval.",
      });
    } else if (dosing.auc24 < AUC_TARGET_LOW) {
      out.push({
        severity: "warning",
        message: "AUC below target 400–600. Consider increasing dose or shortening interval.",
      });
    }
  }

  if (dosing.predictedPeak != null && dosing.predictedPeak > PEAK_MAX) {
    out.push({
      severity: "error",
      message: `Predicted peak > ${PEAK_MAX} mg/L. Risk of Red Man syndrome; consider longer infusion or lower single dose.`,
    });
  }

  return out;
}

export function generateClinicalSuggestions(
  patient: PatientProfileInput,
  dosing: DosingContext
): CoachSuggestion[] {
  const analyzed = analyzePatientProfile(patient, dosing);
  const extra: CoachSuggestion[] = [];

  if (patient.age >= 65 && dosing.auc24 != null && dosing.auc24 > AUC_TARGET_HIGH) {
    extra.push({
      severity: "info",
      message: "Elderly patients may have higher nephrotoxicity risk at elevated AUC; consider targeting lower end of range.",
    });
  }

  return [...analyzed, ...extra];
}

export function detectCommonErrors(
  levels: SerumLevelInput[],
  doseHistory: { doseMg: number; startTimeHr: number; infusionHr: number }[],
  intervalHr: number,
  halfLifeHr: number | null
): CoachSuggestion[] {
  const out: CoachSuggestion[] = [];

  if (levels.length === 0) return out;

  const minSteadyStateHr = halfLifeHr != null ? STEADY_STATE_MULTIPLE * halfLifeHr : 24;

  for (const lv of levels) {
    if (lv.timeHours < 1 && (lv.levelType === "peak" || !lv.levelType)) {
      out.push({
        severity: "warning",
        message: "Peak drawn very early (< 1 h). Peak typically occurs at end of infusion; verify draw timing.",
      });
    }
    if (lv.levelType === "trough" && lv.timeHours < minSteadyStateHr && halfLifeHr != null) {
      out.push({
        severity: "warning",
        message: `Trough sample timing may be before steady state (~${Math.round(minSteadyStateHr)} h). Interpret with caution.`,
      });
    }
  }

  if (doseHistory.length > 0) {
    const intervals: number[] = [];
    for (let i = 1; i < doseHistory.length; i++) {
      intervals.push(doseHistory[i].startTimeHr - doseHistory[i - 1].startTimeHr);
    }
    const consistentInterval = intervals.every((d) => Math.abs(d - intervalHr) < 0.5);
    if (!consistentInterval && intervals.length > 0) {
      out.push({
        severity: "warning",
        message: "Dosing interval mismatch: recorded doses are not evenly spaced. Check dose history.",
      });
    }
  }

  return out;
}

export function getVancoCoachSuggestions(
  patient: PatientProfileInput,
  dosing: DosingContext,
  levels: SerumLevelInput[],
  doseHistory: { doseMg: number; startTimeHr: number; infusionHr: number }[],
  halfLifeHr: number | null
): CoachSuggestion[] {
  const a = generateClinicalSuggestions(patient, dosing);
  const b = detectCommonErrors(levels, doseHistory, dosing.intervalHr, halfLifeHr);
  const seen = new Set<string>();
  return [...a, ...b].filter((s) => {
    const key = s.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
