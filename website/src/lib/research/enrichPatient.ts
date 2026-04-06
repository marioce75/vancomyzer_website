/**
 * Auto-calculate derived patient metrics for research records.
 *
 * BMI, FFM (Janmahasatian 2005), IBW (Devine), AdjBW, CrCl (Cockcroft-Gault).
 * Reuses existing implementations where available.
 */

import { calculateBMI, calculateFFM, calculateCrCl } from "@/lib/pk/obesityModel";
import { capAge } from "./deidentify";

// Devine IBW equations
function calculateIBW(height_cm: number, sex: "male" | "female"): number {
  const height_inches = height_cm / 2.54;
  if (height_inches <= 60) {
    return sex === "male" ? 50 : 45.5;
  }
  const excess = height_inches - 60;
  return sex === "male" ? 50 + 2.3 * excess : 45.5 + 2.3 * excess;
}

function calculateAdjBW(tbw: number, ibw: number): number | null {
  // Only relevant for BMI 30-40
  if (tbw <= ibw * 1.2) return null; // Not significantly above IBW
  return ibw + 0.4 * (tbw - ibw);
}

export interface EnrichedPatientFields {
  age: number;
  bmi: number;
  ffm_kg: number;
  ibw_kg: number;
  adjbw_kg: number | null;
  crcl_baseline: number;
}

export function enrichPatientFields(
  age: number,
  weight_kg: number,
  height_cm: number,
  sex: "male" | "female",
  scr_baseline: number
): EnrichedPatientFields {
  const cappedAge = capAge(age);
  const bmi = calculateBMI(weight_kg, height_cm);
  const ffm = calculateFFM(weight_kg, height_cm, sex);
  const ibw = calculateIBW(height_cm, sex);
  const adjbw = (bmi >= 30 && bmi < 40) ? calculateAdjBW(weight_kg, ibw) : null;
  const crcl = calculateCrCl(cappedAge, weight_kg, scr_baseline, sex);

  return {
    age: cappedAge,
    bmi: Math.round(bmi * 10) / 10,
    ffm_kg: Math.round(ffm * 10) / 10,
    ibw_kg: Math.round(ibw * 10) / 10,
    adjbw_kg: adjbw !== null ? Math.round(adjbw * 10) / 10 : null,
    crcl_baseline: Math.round(crcl * 10) / 10,
  };
}

/**
 * Auto-flag level timing issues.
 */
export function flagLevelTiming(
  levelTimeHours: number,
  doses: { time_hours: number; infusion_duration_min: number }[]
): { during_infusion: boolean; in_distribution_phase: boolean; time_since_infusion_end_h: number } {
  let during_infusion = false;
  let in_distribution_phase = false;
  let time_since_infusion_end_h = Infinity;

  for (const dose of doses) {
    const infusionEndH = dose.time_hours + dose.infusion_duration_min / 60;

    // During infusion?
    if (levelTimeHours >= dose.time_hours && levelTimeHours <= infusionEndH) {
      during_infusion = true;
    }

    // Distribution phase? (< 2h after infusion end)
    const timeSinceEnd = levelTimeHours - infusionEndH;
    if (timeSinceEnd > 0 && timeSinceEnd < 2) {
      in_distribution_phase = true;
    }

    if (timeSinceEnd >= 0 && timeSinceEnd < time_since_infusion_end_h) {
      time_since_infusion_end_h = timeSinceEnd;
    }
  }

  return {
    during_infusion,
    in_distribution_phase,
    time_since_infusion_end_h: time_since_infusion_end_h === Infinity ? 0 : Math.round(time_since_infusion_end_h * 100) / 100,
  };
}
