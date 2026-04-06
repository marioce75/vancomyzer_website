/**
 * KDIGO 2012 AKI auto-detection from SCr trajectory.
 *
 * Stage 1: SCr rise ≥ 0.3 mg/dL within 48h OR ≥ 1.5× baseline within 7 days
 * Stage 2: SCr ≥ 2.0× baseline
 * Stage 3: SCr ≥ 3.0× baseline OR SCr ≥ 4.0 mg/dL with acute rise ≥ 0.5 mg/dL
 *
 * Pure function — no side effects.
 */

import type { ScrTrajectoryPoint, KdigoResult } from "@/types/research";

export function detectKdigoAKI(
  trajectory: ScrTrajectoryPoint[],
  baseline: number
): KdigoResult {
  if (trajectory.length < 2 || baseline <= 0) {
    return { detected: false, stage: 0, onset_day: null, details: "Insufficient SCr data for AKI assessment." };
  }

  const sorted = [...trajectory].sort((a, b) => a.time_hours - b.time_hours);

  let worstStage: 0 | 1 | 2 | 3 = 0;
  let onsetHours: number | null = null;
  let details = "No AKI detected.";

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const ratio = current.scr_mg_dl / baseline;
    let stageAtPoint: 0 | 1 | 2 | 3 = 0;
    let reason = "";

    // ── Stage 3 checks ──
    if (ratio >= 3.0) {
      stageAtPoint = 3;
      reason = `SCr ${current.scr_mg_dl.toFixed(2)} ≥ 3.0× baseline (${baseline.toFixed(2)})`;
    } else if (current.scr_mg_dl >= 4.0) {
      // Check acute rise ≥ 0.5 from any prior point
      const hasAcuteRise = sorted.slice(0, i).some(
        prev => current.scr_mg_dl - prev.scr_mg_dl >= 0.5
      );
      if (hasAcuteRise) {
        stageAtPoint = 3;
        reason = `SCr ${current.scr_mg_dl.toFixed(2)} ≥ 4.0 mg/dL with acute rise ≥ 0.5`;
      }
    }

    // ── Stage 2 check ──
    if (stageAtPoint < 2 && ratio >= 2.0) {
      stageAtPoint = 2;
      reason = `SCr ${current.scr_mg_dl.toFixed(2)} ≥ 2.0× baseline (${baseline.toFixed(2)})`;
    }

    // ── Stage 1 checks ──
    if (stageAtPoint < 1) {
      // Check 48h window: any prior SCr within 48h with rise ≥ 0.3
      const within48h = sorted.filter(
        prev => prev.time_hours < current.time_hours &&
                (current.time_hours - prev.time_hours) <= 48
      );
      const has03Rise = within48h.some(
        prev => current.scr_mg_dl - prev.scr_mg_dl >= 0.3
      );

      // Check 7-day window: ratio ≥ 1.5× baseline
      if (has03Rise) {
        stageAtPoint = 1;
        reason = `SCr rise ≥ 0.3 mg/dL within 48h window`;
      } else if (ratio >= 1.5) {
        // Only count if within 7-day window of the baseline measurement
        const baselinePoint = sorted[0]; // first measurement is closest to baseline
        const daysFromBaseline = (current.time_hours - baselinePoint.time_hours) / 24;
        if (daysFromBaseline <= 7) {
          stageAtPoint = 1;
          reason = `SCr ${current.scr_mg_dl.toFixed(2)} ≥ 1.5× baseline within 7 days`;
        }
      }
    }

    // Track worst stage and earliest onset
    if (stageAtPoint > worstStage) {
      worstStage = stageAtPoint;
      onsetHours = current.time_hours;
      details = `KDIGO Stage ${stageAtPoint}: ${reason} at T+${current.time_hours.toFixed(1)}h`;
    }
  }

  return {
    detected: worstStage > 0,
    stage: worstStage,
    onset_day: onsetHours !== null ? Math.floor(onsetHours / 24) : null,
    details,
  };
}
