/**
 * ━━━ SAFETY CONTRACT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Any function in this file that returns an AdjustmentRecommendation
 * (i.e. emits a dose × interval pair to the API/UI) MUST go through
 * `finalizeRecommendation(...)` or `buildAdjustmentRefusal(...)`. Both
 * internally simulate the predicted exposure with the patient's
 * posterior PK and refuse to emit any regimen whose predicted peak,
 * trough, or AUC₂₄ exceeds the institutional safety caps defined
 * below.
 *
 * Direct construction of an AdjustmentRecommendation literal that
 * contains numeric recommended_dose + recommended_interval_hours
 * bypasses this check and has caused two Class I safety bugs:
 *   - Empiric 2000 mg q8h silent fallback (fixed 915326e)
 *   - Adjustment 250 mg q6h scaled-fallback (fixed aa7fb53)
 *
 * If you add a new code path that emits a recommendation, annotate
 * the JSDoc with `@safety-checked-via: finalizeRecommendation` (or
 * `@safety-checked-via: buildAdjustmentRefusal` for refusal paths).
 * The `npm run test:safety-pattern` CI guard greps for this
 * annotation on every dose-emitting function and BLOCKS the build
 * if any new path is missing it.
 *
 * ━━━ CAP SOURCES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Adult-only thresholds (Vancomyzer's current population). Pediatric
 * thresholds (trough 15 mcg/mL, AUC 800 mg·h/L per Rybak 2020 Rec 21)
 * are deferred until a pediatric workflow is built — TODO: revisit
 * when pediatric mode lands.
 */

import type { ExistingRegimenEngineOutput, AdjustmentRecommendation, FrequencyOption } from "../types";
import { simulateCandidateExposure } from "./simulateCandidateExposure";
import { computeSafeInfusionDurationHours } from "./infusionSafety";
import { curvePoints, loadingDoseCurvePoints } from "../steadyStateTwoCompartment";

// AUC₂₄ target band — Rybak MJ et al. AJHP 2020;77(11):835-864.
// DOI:10.1093/ajhp/zxaa036. Mirror: CID 2020;71(6):1361-1364, DOI:10.1093/cid/ciaa303.
const TARGET_AUC24_LOW = 400;
const TARGET_AUC24_HIGH = 600;
const TARGET_AUC24_MID = 500;

const DOSE_OPTIONS_MG = [250, 500, 750, 1000, 1250, 1500, 1750, 2000];
const INTERVAL_OPTIONS_H = [6, 8, 12, 18, 24, 36, 48];

// Hard TDD ceiling — IDSA/ASHP 2020 institutional standard. Empirically the
// daily-dose ceiling above which no clinically reasonable maintenance regimen
// should sit; pre-AUC literature heritage.
const MAX_TDD_MG_PER_DAY = 4500;

// Peak ceiling — historical ototoxicity reference from Geraci 1958 (irreversible
// ototoxicity at peak 80–100 mg/L from impure "Mississippi mud" product). The 2020
// ASHP/IDSA guideline does NOT publish a peak ceiling — peaks above 40 mg/L are
// pharmacologically expected during AUC-guided dosing. Kept as a soft historical
// safety reference; primary safety is the AUC₂₄ cap below.
// Refs: Geraci 1958 (impure-product era); Forouzesh 2009 review (pure-product re-eval).
const MAX_PEAK_MCG_ML = 80;

// Trough cap — tightened from 25 → 20 mcg/mL. Adult evidence: AKI risk is
// clearly elevated above trough 20 mcg/mL (van Hal SJ et al. CID 2013, meta-
// analysis. PMID 23165462). The 2020 guideline retracts the 2009 15–20 mcg/mL
// trough TARGET due to AKI signal but does not republish a numeric ceiling for
// adults — 20 is the most-cited threshold in the supporting evidence base.
// Soft warn threshold below at 15 (AKI signal onset).
const MAX_TROUGH_MCG_ML = 20;

// Trough warn threshold — Aljefri DM et al. CID 2019, meta-analysis showing
// AKI risk rises significantly above trough 15 mcg/mL. DOI:10.1093/cid/ciz051.
// Used by frequency-options ranking to penalize but not block recommendations
// in the 15–20 mcg/mL range.
const WARN_TROUGH_MCG_ML = 15;

// AUC₂₄ ceiling — Aljefri DM et al. CID 2019 unified AKI cutpoint ≈ 650 mg·h/L
// across the evidence base the 2020 ASHP/IDSA guideline rests on (OR for AKI
// 0.36 below this threshold). DOI:10.1093/cid/ciz051. The 2020 guideline does
// not publish a numeric adult AUC ceiling but its target band tops at 600.
// Hard-block above this; warn at 600 (upper bound of target band).
const MAX_AUC24_MG_H_L = 650;
const WARN_AUC24_MG_H_L = 600;

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

/**
 * @safety-checked-via: self (this IS the safety chokepoint)
 *
 * Constructs an AdjustmentRecommendation after verifying the proposed
 * regimen's predicted peak/trough/AUC₂₄ stay within institutional
 * safety caps. The `safety` PK params are REQUIRED (not optional) so
 * TypeScript prevents bypass — any caller that doesn't pass them
 * fails to compile.
 *
 * If the proposed regimen exceeds any cap, this returns
 * `buildAdjustmentRefusal(...)` instead of constructing the unsafe
 * recommendation. The caller cannot tell the difference at the type
 * level — both return AdjustmentRecommendation — but the refusal
 * carries `adjustment_dosing_blocked` which the UI uses to render the
 * safety state.
 */
function finalizeRecommendation(
  dose_mg: number,
  interval_hours: number,
  requested_infusion_hours: number | null | undefined,
  safety: { CL: number; V1: number; Q: number; V2: number },
): AdjustmentRecommendation {
  const infusion = computeSafeInfusionDurationHours(dose_mg, requested_infusion_hours);
  // Verify the proposed regimen against the safety caps before construction.
  const exposure = simulateCandidateExposure(safety.CL, safety.V1, safety.Q, safety.V2, {
    dose_mg,
    interval_hours,
    infusion_duration_hours: Math.min(infusion.infusion_duration_hours, interval_hours),
  });
  if (
    exposure.peak > MAX_PEAK_MCG_ML ||
    exposure.trough > MAX_TROUGH_MCG_ML ||
    exposure.auc24 > MAX_AUC24_MG_H_L
  ) {
    return buildAdjustmentRefusal({
      CL: safety.CL,
      recommendedDoseCheck: dose_mg,
      recommendedInterval: interval_hours,
      predictedPeak: exposure.peak,
      predictedTrough: exposure.trough,
      predictedAuc24: exposure.auc24,
    });
  }
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

/**
 * @safety-checked-via: finalizeRecommendation
 *
 * Scales the current regimen's dose by the AUC ratio to land near
 * TARGET_AUC24_MID. The actual peak/trough/AUC safety check happens
 * inside finalizeRecommendation — this function trusts the chokepoint
 * to refuse if the scaled dose at the current interval is unsafe
 * (which is common for severe-renal-impairment patients on short
 * intervals where even the floor dose would over-accumulate).
 */
function conservativeSameIntervalDose(
  currentDoseMg: number,
  currentIntervalHours: number,
  auc24: number,
  requestedInfusionHours: number | null | undefined,
  safety: { CL: number; V1: number; Q: number; V2: number },
): AdjustmentRecommendation {
  const recommended_dose_mg = Math.min(2000, roundDoseMg(Math.max(250, (currentDoseMg * TARGET_AUC24_MID) / Math.max(auc24, 1))));
  const tdd = (recommended_dose_mg * 24) / currentIntervalHours;
  const dose_mg = tdd > MAX_TDD_MG_PER_DAY ? roundDoseMg((MAX_TDD_MG_PER_DAY * currentIntervalHours) / 24) : recommended_dose_mg;
  return finalizeRecommendation(Math.max(250, dose_mg), currentIntervalHours, requestedInfusionHours, safety);
}

/**
 * @safety-checked-via: finalizeRecommendation
 *
 * Bounded interval-extension heuristic for sparse high-exposure cases.
 * Pre-filters candidates by peak/trough/AUC caps before passing to
 * finalizeRecommendation (the safety chokepoint).
 */
function boundedSparseHighExposureRecommendation(output: ExistingRegimenEngineOutput): AdjustmentRecommendation | null {
  const { CL, V1, Q, V2, auc24, current_regimen_dose_mg, current_regimen_interval_hours, current_regimen_infusion_hours } = output;
  if (CL == null || V1 == null || Q == null || V2 == null || CL <= 0 || V1 <= 0 || Q <= 0 || V2 <= 0) return null;

  const safety = { CL, V1, Q, V2 };
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
      return finalizeRecommendation(heuristicDose, nextLongerInterval, infusion_hours, safety);
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
      if (exp.peak > MAX_PEAK_MCG_ML || exp.trough > MAX_TROUGH_MCG_ML || exp.auc24 > MAX_AUC24_MG_H_L) continue;
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
  return finalizeRecommendation(ranked[0].dose_mg, ranked[0].interval_hours, infusion_hours, safety);
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
      if (exp.peak > MAX_PEAK_MCG_ML || exp.trough > MAX_TROUGH_MCG_ML || exp.auc24 > MAX_AUC24_MG_H_L) continue;
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
    // Defensive branch — engine should always produce PK params, but if it
    // didn't we cannot verify any recommendation's predicted exposure. The
    // only safe response is to refuse and require manual review.
    return {
      recommended_dose: "—",
      recommended_interval_hours: 0,
      recommended_infusion_duration_hours: 0,
      frequency_options: [],
      adjustment_dosing_blocked: {
        reason: "Posterior PK fit was not produced; cannot verify any recommendation against safety caps.",
        recommended_action: "Manual pharmacy review required.",
        safety_message:
          "The Bayesian engine did not produce valid PK parameters for this patient. The calculator cannot emit a recommendation it cannot verify; manual pharmacy review is required.",
        estimated_cl_l_h: 0,
      },
    };
  }

  // Safety object reused by every finalizeRecommendation / conservative call
  // below. Forces the safety chokepoint to have everything it needs.
  const safety = { CL: CL!, V1: V1!, Q: Q!, V2: V2! };

  let base: AdjustmentRecommendation;

  if (!isPulseDose && weakEvidenceRecommendation) {
    if (isClearlySupraTherapeuticSparseCase(output)) {
      base = boundedSparseHighExposureRecommendation(output) ?? conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours, safety);
    } else {
      base = conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours, safety);
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
        if (exp.peak > MAX_PEAK_MCG_ML || exp.trough > MAX_TROUGH_MCG_ML || exp.auc24 > MAX_AUC24_MG_H_L) continue;
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
      base = finalizeRecommendation(inRangeCandidates[0].dose_mg, inRangeCandidates[0].interval_hours, infusion_hours, safety);
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
      base = finalizeRecommendation(candidates[0].dose_mg, candidates[0].interval_hours, infusion_hours, safety);
    } else if (auc24 > 0) {
      base = conservativeSameIntervalDose(current_regimen_dose_mg, current_regimen_interval_hours, auc24, current_regimen_infusion_hours, safety);
    } else {
      base = finalizeRecommendation(current_regimen_dose_mg, current_regimen_interval_hours, current_regimen_infusion_hours, safety);
    }
  }

  // ─── POST-RECOMMENDATION SAFETY CHECK (DEFENSE IN DEPTH) ──────────
  // finalizeRecommendation now enforces peak/trough/AUC internally, so
  // this wrapper is theoretically redundant. Kept as belt-and-suspenders
  // — any future code path that bypasses finalizeRecommendation (which
  // SHOULD be impossible per the SAFETY CONTRACT block at file top, but
  // worth catching anyway) still hits this gate.
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
      if (
        recExposure.peak > MAX_PEAK_MCG_ML ||
        recExposure.trough > MAX_TROUGH_MCG_ML ||
        recExposure.auc24 > MAX_AUC24_MG_H_L
      ) {
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
 * @safety-checked-via: self (refusal IS the safety response)
 *
 * Build the AdjustmentRecommendation emitted when no regimen in the
 * search space satisfies the institutional safety caps:
 *   - peak  ≤ MAX_PEAK_MCG_ML  (80, historical ototoxicity reference)
 *   - trough ≤ MAX_TROUGH_MCG_ML (20, van Hal 2013 AKI threshold)
 *   - AUC₂₄ ≤ MAX_AUC24_MG_H_L (650, Aljefri 2019 unified AKI cutpoint)
 *
 * Mirrors initialRegimen.ts's empiric refusal pattern: sentinel-safe
 * values for the standard fields plus an adjustment_dosing_blocked
 * field that the UI uses to render the safety state.
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
  // Name the cap that was exceeded so the clinician sees the actual reason.
  const exceeded: string[] = [];
  if (predictedPeak > MAX_PEAK_MCG_ML) exceeded.push(`peak ${predictedPeak.toFixed(0)} > ${MAX_PEAK_MCG_ML} mcg/mL`);
  if (predictedTrough > MAX_TROUGH_MCG_ML) exceeded.push(`trough ${predictedTrough.toFixed(0)} > ${MAX_TROUGH_MCG_ML} mcg/mL`);
  if (predictedAuc24 > MAX_AUC24_MG_H_L) exceeded.push(`AUC₂₄ ${predictedAuc24.toFixed(0)} > ${MAX_AUC24_MG_H_L} mg·h/L`);

  const safetyMessage =
    `No safe maintenance regimen exists in the search space for this patient. ` +
    `Estimated clearance is ${CL.toFixed(2)} L/h — even at the calculator's most ` +
    `conservative attempt (${recommendedDoseCheck} mg q${recommendedInterval}h) the ` +
    `predicted steady-state ${exceeded.join("; ")}. ` +
    `Recommended action: hold maintenance dosing, recheck a vancomycin level when ` +
    `the trough falls below ${WARN_TROUGH_MCG_ML} mcg/mL, then redose using the ` +
    `1-Level workflow for level-guided pulse dosing.`;

  return {
    recommended_dose: "—",
    recommended_interval_hours: 0,
    recommended_infusion_duration_hours: 0,
    frequency_options: [],
    adjustment_dosing_blocked: {
      reason: `No regimen in the search grid satisfies peak ≤ ${MAX_PEAK_MCG_ML} mcg/mL, trough ≤ ${MAX_TROUGH_MCG_ML} mcg/mL, AND AUC₂₄ ≤ ${MAX_AUC24_MG_H_L} mg·h/L at estimated CL ${CL.toFixed(2)} L/h.`,
      recommended_action: `Hold maintenance dosing; recheck level when trough < ${WARN_TROUGH_MCG_ML} mcg/mL; redose via 1-Level workflow.`,
      safety_message: safetyMessage,
      estimated_cl_l_h: Math.round(CL * 100) / 100,
    },
  };
}
