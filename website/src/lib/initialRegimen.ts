import { validateRawInput } from "./pk/validate/validateRawInput";
/**
 * First-pass initial regimen calculation for Vancomyzer.
 * For new patients only; no existing regimen or measured levels.
 */

import { buildPriorParameters } from "./pk/posterior/buildPriorParameters";
import { buildEmpiricLoadingDose } from "./pk/recommend/buildEmpiricLoadingDose";
import { simulateCandidateExposure } from "./pk/recommend/simulateCandidateExposure";
import { computeSafeInfusionDurationHours } from "./pk/recommend/infusionSafety";
import { curvePoints, type CredibleBandSpec } from "./pk/steadyStateTwoCompartment";
import { priorParameterUncertainty, summarizeParameterUncertainty } from "./pk/posterior/parameterUncertainty";
import { buildInitialRegimenReviewStatus } from "./pk/response/buildReviewStatus";
import { highBmiAdvisory, modelShortName, renalCovariateDescription } from "./pk/modelRegistry";
import { DEFAULT_DOSE_POLICY, type DosePolicy } from "./pk/dosePolicy";
import {
  ARC_THRESHOLD_ML_MIN_1_73,
  crclOnTotalBodyWeight,
  displayedCrCl,
  indexToBsa,
} from "./pk/renalEstimate";
import type { CalculationDetails, FrequencyOption } from "@/types/calculator";

interface Patient {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female" | "";
  serum_creatinine_mg_dl: number;
}

export type AucRangeStatus = "in_range" | "below_target" | "above_target";

/** Kept in sync by hand with the identical shape in src/types/calculator.ts. */
export interface ArcAdvisory {
  detected: boolean;
  /** Cockcroft-Gault on total body weight, absolute mL/min. */
  crcl_ml_min?: number;
  /**
   * The same clearance indexed to 1.73 m2, the basis the ARC definition uses.
   * Absent when height was not entered, so BSA could not be derived.
   */
  crcl_indexed_ml_min_1_73?: number;
  cl_l_h?: number;
  required_tdd_mg?: number;
  continuous_infusion_rate_mg_h?: number;
  message?: string;
}

export interface InitialRegimenResult {
  recommendation_type: "initial_regimen";
  auc24: number;
  peak: number;
  trough: number;
  auc_range_status: AucRangeStatus;
  arc_advisory?: ArcAdvisory;
  recommended_dose: string;
  recommended_interval_hours: number;
  recommended_infusion_duration_hours: number;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: { time_hours: number; concentration: number; lower?: number; upper?: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  calculation_details: CalculationDetails;
  parameter_uncertainty?: ReturnType<typeof summarizeParameterUncertainty>;
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
    pk_model_name?: "colin_2019" | "vancomyzer_obesity";
    ffm_kg?: number;
  };
  /**
   * Set when no safe fixed-interval regimen exists in the search space — i.e.
   * estimated clearance is so low that every candidate at q6/q8/q12/q24 with
   * dose ≥ 500 mg would exceed the AUC ceiling or trough cap. The UI MUST render
   * the pulse-dose safety state in place of the standard regimen card; the
   * recommended_dose / recommended_interval_hours / auc24 / peak / trough fields
   * remain populated with sentinel-safe values (0) so downstream consumers don't
   * crash, but they are not clinically meaningful and must not be displayed.
   *
   * This is the engine's explicit safety refusal — fixing the prior bug where a
   * silent 2000mg q8h fallback emitted catastrophically wrong regimens for
   * patients with severe renal impairment.
   */
  empiric_dosing_blocked?: {
    reason: string;
    recommended_pulse_dose_mg: number;
    safety_message: string;
    estimated_cl_l_h: number;
  };
}

const TARGET_AUC24_LOW = 400;
const TARGET_AUC24_HIGH = 600;
const TARGET_AUC24_MID = 500;

// Dose grid: minimum 500 mg (clinical floor — sub-500 mg empiric dosing belongs
// in the level-guided pulse-dose workflow, not fixed-interval). Capped at 2000 mg
// per IDSA/ASHP 2020 guideline (15–20 mg/kg, institutional cap 2000 mg).
const DOSE_OPTIONS_MG = [500, 750, 1000, 1250, 1500, 1750, 2000];
// Q6h added for high-clearance patients who need more frequent dosing.
// Intervals beyond q24h are intentionally NOT in the grid — when the search
// returns no safe candidate at q6/q8/q12/q24, the engine falls through to a
// pulse-dose recommendation (single dose + level-guided redose) rather than
// silently emitting an unsafe regimen. See empiricDosingBlocked path below.
const INTERVAL_OPTIONS_H = [6, 8, 12, 24];
const DEFAULT_INFUSION_HOURS = 1;

// Max single maintenance dose: 2000 mg per IDSA/ASHP 2020 guideline institutional standard
// (Loading dose max of 3000 mg is separate — see buildEmpiricLoadingDose.ts)
const MAX_SINGLE_DOSE_MG = 2000;

/**
 * Per-dose ceiling in mg/kg. The 2020 ASHP/IDSA/PIDS/SIDP maintenance band is
 * 15-20 mg/kg per dose; 25 leaves headroom for rounding to the dose grid
 * without admitting amounts no guideline supports. The absolute 2000 mg cap
 * alone did not bound this: a 45 kg adult could be offered 2000 mg q24h, which
 * is 44 mg/kg in a single dose.
 */
const MAX_DOSE_MG_PER_KG = 25;

// Max TDD safety cap per ASHP/IDSA 2020 guidelines: 4500 mg/day hard ceiling.
// An institution may configure a lower ceiling at /settings; it can never raise
// one (dosePolicyFromSettings clamps), so this takes the smaller of the two.
function getMaxTdd(scr: number, policy: DosePolicy): number {
  const tier =
    scr >= 3.5 ? 1000 :          // severely impaired
    scr >= 2.0 ? 2000 :          // moderately impaired
    scr >= 1.3 ? 3000 :          // mildly impaired
    4500;                        // normal renal function — guideline max
  return Math.min(tier, policy.maxDailyDoseMg);
}

// Safety caps — sourced from the 2020 ASHP/IDSA/PIDS/SIDP guideline supporting
// evidence base. See buildAdjustmentRecommendation.ts SAFETY CONTRACT block
// for full citations; values must stay in sync between the two files.
//
//   MAX_PEAK_MCG_ML  = 80   — historical Geraci 1958 ototoxicity reference;
//                              2020 guideline does NOT publish a peak ceiling
//   MAX_TROUGH_MCG_ML = 20  — tightened from 25 to van Hal 2013 (PMID 23165462)
//                              adult-AKI threshold; pediatric (deferred) is 15
//   MAX_AUC24_MG_H_L = 650 — Aljefri 2019 (DOI 10.1093/cid/ciz051) unified
//                              AKI cutpoint; 2020 guideline target tops at 600
const MAX_PEAK_MCG_ML = 80;
const MAX_TROUGH_MCG_ML = 20;
const MAX_AUC24_MG_H_L = 650;

function chooseInitialCandidate(CL: number, V1: number, Q: number, V2: number, scr: number, weight_kg: number, policy: DosePolicy) {
  const candidates: {
    dose_mg: number;
    interval_hours: number;
    auc24: number;
    peak: number;
    trough: number;
    inRange: boolean;
  }[] = [];

  const maxTdd = getMaxTdd(scr, policy);

  for (const interval_hours of INTERVAL_OPTIONS_H) {
    for (const dose_mg of DOSE_OPTIONS_MG) {
      if (dose_mg > Math.min(MAX_SINGLE_DOSE_MG, policy.maxSingleDoseMg)) continue;
      const tdd = (dose_mg * 24) / interval_hours;
      if (tdd > maxTdd) continue;
      // Bound the amount given at once, not just the daily total.
      if (weight_kg > 0 && dose_mg / weight_kg > MAX_DOSE_MG_PER_KG) continue;
      const infDuration = computeSafeInfusionDurationHours(dose_mg).infusion_duration_hours;
      // Infusion must not exceed 2/3 of the dosing interval
      if (infDuration > interval_hours * 0.67) continue;
      const exposure = simulateCandidateExposure(CL, V1, Q, V2, {
        dose_mg,
        interval_hours,
        infusion_duration_hours: infDuration,
      });
      if (exposure.peak > MAX_PEAK_MCG_ML || exposure.trough > MAX_TROUGH_MCG_ML || exposure.auc24 > MAX_AUC24_MG_H_L) continue;
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
    // On an exact AUC tie, prefer the conventional interval rather than the
    // longest. Equal predicted exposure does not make 2000 mg q24h equivalent
    // to 1000 mg q12h — the guideline band is stated per dose, and the old
    // "longest interval wins" rule made q24h the default for 560 of 720
    // realistic normal-renal adults, with a per-dose amount above 25 mg/kg in
    // 152 of them. Ties are exact and common because AUC24 depends only on the
    // daily dose, so this tie-break decides a large share of empiric output.
    const CONVENTIONAL_INTERVAL_H = 12;
    const aFromConventional = Math.abs(a.interval_hours - CONVENTIONAL_INTERVAL_H);
    const bFromConventional = Math.abs(b.interval_hours - CONVENTIONAL_INTERVAL_H);
    if (aFromConventional !== bFromConventional) return aFromConventional - bFromConventional;
    if (a.interval_hours !== b.interval_hours) return b.interval_hours - a.interval_hours;
    const dailyDoseA = (a.dose_mg * 24) / a.interval_hours;
    const dailyDoseB = (b.dose_mg * 24) / b.interval_hours;
    return dailyDoseA - dailyDoseB;
  });

  // If the search produced no candidate, return null and let the caller
  // route to the pulse-dose safety path. The previous behavior here
  // silently emitted 2000 mg q8h regardless of patient — for severe AKI
  // with CL ~0.2 L/h that produced AUC₂₄ ≈ 30,000 and a trough ≈ 1240
  // mcg/mL, a fatal regimen. The empty-search outcome is the engine's
  // correct signal that fixed-interval empiric dosing is not safe.
  if (ranked.length === 0) {
    return { best: null, candidates };
  }

  return { best: ranked[0], candidates };
}

interface FrequencyOptionContext {
  scr: number;
  modelLabel: string;
  ffm_kg?: number;
  loadingDoseMg: number;
  loadingDoseBasis: string;
  arcNote: string;
}

function buildOptionInterpretation(
  opt: { dose_mg: number; interval_hours: number; auc24: number; peak: number; trough: number },
  infDurationHours: number,
  ctx: FrequencyOptionContext,
): string {
  const aucStatus = getAucRangeStatus(opt.auc24);
  const belowNote = aucStatus === "below_target"
    ? ` NOTE: This regimen achieves AUC24 ${opt.auc24} mg\u00b7h/L, which is below the target range of 400\u2013600. Clinical review is required.`
    : "";
  return (
    `Initial regimen option: ${opt.dose_mg} mg every ${opt.interval_hours} hours infused over ${infDurationHours} hours. ` +
    `Prior-based initial estimate: AUC24 ${opt.auc24} mg\u00b7h/L; peak ${opt.peak} mg/L; trough ${opt.trough} mg/L. ` +
    `SCr ${ctx.scr} mg/dL (${ctx.modelLabel} renal covariate).` +
    ctx.arcNote + belowNote +
    ` If immediate severe-infection coverage is clinically necessary under local practice, a clinician may optionally consider an empiric loading-dose estimate around ${ctx.loadingDoseMg} mg (${ctx.loadingDoseBasis}) before maintenance dosing. ` +
    `No measured levels; re-evaluate after levels are available. Intended to support review, not replace clinician judgment.`
  );
}

function buildFrequencyOptions(
  candidates: { dose_mg: number; interval_hours: number; auc24: number; peak: number; trough: number; inRange: boolean }[],
  recommended: { dose_mg: number; interval_hours: number },
  CL: number, V1: number, Q: number, V2: number,
  ctx: FrequencyOptionContext,
  band?: CredibleBandSpec,
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
      0.25,
      band,
    );
    const auc24 = Math.round(pick.auc24 * 10) / 10;
    const peak = Math.round(pick.peak * 10) / 10;
    const trough = Math.round(pick.trough * 10) / 10;
    options.push({
      dose_mg: pick.dose_mg,
      interval_hours: interval,
      auc24,
      peak,
      trough,
      infusion_duration_hours: T_inf,
      is_recommended: pick.dose_mg === recommended.dose_mg && interval === recommended.interval_hours,
      curve: optCurve,
      interpretation_summary: buildOptionInterpretation(
        { dose_mg: pick.dose_mg, interval_hours: interval, auc24, peak, trough },
        T_inf,
        ctx,
      ),
    });
  });

  // Sort by interval ascending
  options.sort((a, b) => a.interval_hours - b.interval_hours);
  return options;
}

function getAucRangeStatus(auc24: number): AucRangeStatus {
  if (auc24 >= TARGET_AUC24_LOW && auc24 <= TARGET_AUC24_HIGH) return "in_range";
  if (auc24 > TARGET_AUC24_HIGH) return "above_target";
  return "below_target";
}

/**
 * Thrown when computeInitialRegimen is handed inputs outside the adult
 * intermittent-infusion scope. The API route checks these before calling, but
 * nothing below the route did — so through any other caller an SCr entered in
 * µmol/L (88.4) came back as a confident "severe renal impairment" refusal
 * describing a unit error rather than a patient, and a 17-year-old came back
 * with a full regimen computed from the age-18 prior.
 */
export class InitialRegimenInputError extends Error {
  readonly error_type = "validation_error" as const;
  readonly field_errors: Record<string, string>;

  constructor(field_errors: Record<string, string>) {
    super("Patient inputs are outside the adult intermittent-infusion scope of this calculator.");
    this.name = "InitialRegimenInputError";
    this.field_errors = field_errors;
  }
}

/** Bounds mirror validateRequest in the API route and validateExistingRegimenRequest. */
function assertInitialRegimenInputs(patient: Patient): void {
  const field_errors: Record<string, string> = validateRawInput({ patient }, false);
  const { age, weight_kg, serum_creatinine_mg_dl } = patient;
  const height_cm = patient.height_cm ?? 0;

  if (typeof age !== "number" || Number.isNaN(age) || age < 18 || age > 120) {
    field_errors["patient.age"] = "Adult calculator requires age 18-120.";
  }
  if (typeof weight_kg !== "number" || Number.isNaN(weight_kg) || weight_kg < 30 || weight_kg > 400) {
    field_errors["patient.weight_kg"] = "Weight must be 30-400 kg.";
  }
  if (
    typeof serum_creatinine_mg_dl !== "number" ||
    Number.isNaN(serum_creatinine_mg_dl) ||
    serum_creatinine_mg_dl < 0.1 ||
    serum_creatinine_mg_dl > 10
  ) {
    field_errors["patient.serum_creatinine_mg_dl"] =
      "SCr must be 0.1-10 mg/dL. A value near 88 is micromol/L — divide by 88.4 to convert.";
  }
  if (height_cm !== 0 && (Number.isNaN(height_cm) || height_cm < 100 || height_cm > 250)) {
    field_errors["patient.height_cm"] = "Height must be 100-250 cm.";
  }

  if (Object.keys(field_errors).length > 0) {
    throw new InitialRegimenInputError(field_errors);
  }
}

export function computeInitialRegimen(
  patient: Patient,
  policy: DosePolicy = DEFAULT_DOSE_POLICY,
): InitialRegimenResult {
  assertInitialRegimenInputs(patient);
  const prior = buildPriorParameters(
    {
      age: patient.age,
      weight_kg: patient.weight_kg,
      height_cm: patient.height_cm ?? 0,
      sex: patient.sex ?? "",
      serum_creatinine_mg_dl: patient.serum_creatinine_mg_dl,
    },
    {
      dose_mg: 1000,
      interval_hours: 12,
      infusion_duration_hours: DEFAULT_INFUSION_HOURS,
    }
  );

  const { best: choice, candidates } = chooseInitialCandidate(prior.CL, prior.V1, prior.Q, prior.V2, prior.scr, patient.weight_kg, policy);
  const loadingDose = buildEmpiricLoadingDose({ actual_body_weight_kg: patient.weight_kg, policy });

  // ─── SAFETY REFUSAL PATH ──────────────────────────────────────────
  // The empiric search returned no candidate that simultaneously meets
  // the TDD cap, peak cap (80 mcg/mL), trough cap (20 mcg/mL), AND
  // AUC₂₄ cap (650 mg·h/L). For any patient where the steady-state PK
  // math says no fixed-interval regimen at q6/q8/q12/q24 with dose
  // ≥ 500 mg is safe (typically severe renal impairment, CL < ~0.5 L/h,
  // t½ > 50 h), we MUST NOT silently emit a guessed regimen. Refuse
  // the empiric workflow and direct the clinician to pulse-then-level.
  if (choice == null) {
    return buildEmpiricRefusalResult({
      patient,
      prior,
      loadingDose,
    });
  }

  // No levels: the band is the population prior's spread (prior predictive).
  const parameterUncertainty = priorParameterUncertainty(prior, {
    CL: prior.omega_CL, V1: prior.omega_V1, Q: prior.omega_Q, V2: prior.omega_V2,
  });
  const band: CredibleBandSpec | undefined =
    parameterUncertainty.method === "unavailable"
      ? undefined
      : { draws: parameterUncertainty.draws, level: parameterUncertainty.level };

  const safeInfusion = computeSafeInfusionDurationHours(choice.dose_mg);
  const curve = curvePoints(
    {
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      dose_mg: choice.dose_mg,
      tau: choice.interval_hours,
      T_inf: Math.min(safeInfusion.infusion_duration_hours, choice.interval_hours),
    },
    undefined,
    band,
  );

  const recommended_dose = `${choice.dose_mg} mg`;
  const auc24 = Math.round(choice.auc24 * 10) / 10;
  const peak = Math.round(choice.peak * 10) / 10;
  const trough = Math.round(choice.trough * 10) / 10;

  const auc_range_status = getAucRangeStatus(auc24);

  // Displayed renal estimate and ARC detection use different body weights on
  // purpose \u2014 see the header of renalEstimate.ts for the evidence.
  const displayCrCl = displayedCrCl(patient);
  const required_tdd = TARGET_AUC24_MID * prior.CL;

  // ARC is defined at 130 mL/min/1.73 m2 (Udy 2013, Barletta 2017, Cucci 2023),
  // an INDEXED threshold. The previous test compared an absolute Cockcroft-Gault
  // value against 150, so it was both the wrong number and the wrong basis, and
  // it over-flagged patients with a large body surface area. When height is
  // missing BSA cannot be derived, so the absolute value is compared instead \u2014
  // the more sensitive direction, which is the safe one for detection.
  //
  // The `auc_range_status === "below_target"` conjunction was also removed: a
  // patient with genuine augmented clearance whose regimen happens to land
  // inside 400-600 still has augmented clearance, and previously received no
  // warning at all.
  const arcCrclTotalBw = crclOnTotalBodyWeight(patient);
  const arcCrclIndexed = indexToBsa(arcCrclTotalBw, patient.weight_kg, patient.height_cm);
  const arcBasis = arcCrclIndexed ?? arcCrclTotalBw;
  const isArc = arcBasis >= ARC_THRESHOLD_ML_MIN_1_73;

  let arc_advisory: ArcAdvisory | undefined;
  if (isArc) {
    const ci_rate = Math.round(TARGET_AUC24_MID * prior.CL / 24 * 10) / 10;
    // Sex is not a Colin covariate, but Cockcroft-Gault needs it (×0.85 for
    // women). With sex blank the screen used the male value silently; the
    // assumption is now stated so the clinician can discount it.
    const sexNote = patient.sex === "male" || patient.sex === "female" ? "" : "; sex not entered — male assumed for Cockcroft-Gault, ~18% lower if female";
    const basisPhrase = arcCrclIndexed !== null
      ? `${Math.round(arcCrclIndexed)} mL/min/1.73 m\u00b2${sexNote}`
      : `${Math.round(arcCrclTotalBw)} mL/min absolute (height not entered, so it could not be indexed${sexNote})`;
    arc_advisory = {
      detected: true,
      crcl_ml_min: Math.round(arcCrclTotalBw),
      ...(arcCrclIndexed !== null ? { crcl_indexed_ml_min_1_73: Math.round(arcCrclIndexed) } : {}),
      cl_l_h: Math.round(prior.CL * 10) / 10,
      required_tdd_mg: Math.round(required_tdd),
      continuous_infusion_rate_mg_h: ci_rate,
      message:
        `Possible augmented renal clearance: estimated ${basisPhrase} against a threshold of ` +
        `${ARC_THRESHOLD_ML_MIN_1_73} mL/min/1.73 m\u00b2 (CL ${prior.CL.toFixed(1)} L/h). ` +
        `Estimating equations detect augmented clearance poorly \u2014 confirm with a measured 8\u201324 hour ` +
        `urinary creatinine clearance before acting on this. ` +
        `If confirmed, standard intermittent dosing may not achieve target AUC24 of 400\u2013600 mg\u00b7h/L; ` +
        `required TDD \u2248 ${Math.round(required_tdd).toLocaleString()} mg/day. ` +
        `Continuous infusion is outside this calculator's scope \u2014 it is neither modeled nor dosed here, so manage it ` +
        `per local protocol with Infectious Diseases or nephrology input rather than from these numbers. ` +
        `Obtain two vancomycin levels early (2\u20134h and 6\u20138h post-dose) to confirm individual PK.`,
    };
  }

  const modelLabel = modelShortName(prior.model_name);

  const arcNote = arc_advisory
    ? ` NOTE: Possible augmented renal clearance (${arc_advisory.crcl_indexed_ml_min_1_73 ?? arc_advisory.crcl_ml_min} mL/min${arc_advisory.crcl_indexed_ml_min_1_73 ? "/1.73 m²" : " absolute"}, threshold ${ARC_THRESHOLD_ML_MIN_1_73}). Confirm with a measured 8–24 h urinary creatinine clearance; if confirmed, target AUC may not be achievable with standard intermittent dosing.`
    : "";

  const freqCtx: FrequencyOptionContext = {
    scr: prior.scr,
    modelLabel,
    ffm_kg: prior.ffm_kg,
    loadingDoseMg: loadingDose.suggested_dose_mg,
    loadingDoseBasis: loadingDose.basis,
    arcNote,
  };
  const frequencyOptions = buildFrequencyOptions(candidates, choice, prior.CL, prior.V1, prior.Q, prior.V2, freqCtx, band);

  const belowTargetNote = (!arc_advisory && auc_range_status === "below_target")
    ? ` NOTE: Best available regimen achieves AUC24 ${auc24} mg\u00b7h/L, which is below the target range of 400\u2013600. Clinical review is required.`
    : "";

  const interpretation_summary =
    `Initial regimen suggestion: ${recommended_dose} every ${choice.interval_hours} hours infused over ${safeInfusion.infusion_duration_hours} hours. ` +
    `Prior-based initial estimate: AUC24 ${auc24} mg\u00b7h/L; peak ${peak} mg/L; trough ${trough} mg/L. ` +
    `SCr ${prior.scr} mg/dL (${modelLabel} renal covariate).` +
    arcNote + belowTargetNote +
    ` If immediate severe-infection coverage is clinically necessary under local practice, a clinician may optionally consider an empiric loading-dose estimate around ${loadingDose.suggested_dose_mg} mg (${loadingDose.basis}) before maintenance dosing. ` +
    `${safeInfusion.safety_note ? `${safeInfusion.safety_note} ` : ""}` +
    `No measured levels; re-evaluate after levels are available. Intended to support review, not replace clinician judgment.`;

  // High body size gets an advisory, never a different model (modelRegistry.ts).
  const bmiAdvisory = highBmiAdvisory(patient);

  const assumptions = [
    renalCovariateDescription(prior.model_name),
    `Population model: ${modelLabel} two-compartment prior.`,
    "Initial regimen chosen from practical dose/interval candidates using the shared two-compartment steady-state PK model.",
    "AUC24 = (dose \u00d7 24/\u03c4) / CL at steady state \u2014 standard linear PK relationship.",
    "Infusion duration constrained to a minimum of 60 minutes and a maximum rate of 10 mg/min in line with FDA labeling and guideline-based safety framing.",
    "Empiric loading-dose note, when shown, is a capped actual-body-weight estimate for clinician consideration and does not encode severity, indication, or critical-illness context.",
    "No measured vancomycin levels; no posterior or Bayesian update.",
  ];

  const limitations = [
    ...(bmiAdvisory ? [bmiAdvisory] : []),
    "Initial adult prior estimate only; no measured levels are available to individualize PK.",
    "Outputs are model-based prior predictions and should not be interpreted as patient-specific certainty.",
    ...(auc_range_status === "below_target"
      ? ["The best available intermittent regimen does not achieve the target AUC24 of 400\u2013600 mg\u00b7h/L. Clinical review and alternative dosing strategies (e.g., continuous infusion) may be required."]
      : []),
    "Any loading-dose note is optional generic empiric support only and should not replace clinician judgment about infection severity, critical illness, low body weight, or institutional protocol.",
    "Adult concentration limits (for example, dilution \u22645 mg/mL) were not enforced because infusion volume is not entered in this workflow.",
    "Clinical judgment, local protocols, and reassessment after levels remain essential.",
  ];

  const quick_summary = [
    `Initial regimen: ${recommended_dose} every ${choice.interval_hours} hours infused over ${safeInfusion.infusion_duration_hours} hours`,
    `Prior-based estimate: AUC24 ${auc24} mg\u00b7h/L; peak ${peak} mg/L; trough ${trough} mg/L`,
    ...(auc_range_status !== "in_range" ? [`AUC24 STATUS: ${auc_range_status === "below_target" ? "BELOW TARGET" : "ABOVE TARGET"}`] : []),
    ...(safeInfusion.safety_note ? [safeInfusion.safety_note] : []),
    `SCr: ${prior.scr} mg/dL (${modelLabel} renal covariate). Loading-dose considerations are optional, generic empiric support only, and should be reviewed separately from the maintenance suggestion. Assumptions and limitations apply.`,
  ].join("\n");

  const clinical_note = [
    "Vancomycin initial regimen suggestion (no levels).",
    `Dose: ${recommended_dose}; Interval: every ${choice.interval_hours} hours; Infusion: ${safeInfusion.infusion_duration_hours} hours.`,
    `Prior-based estimate: AUC24 ${auc24} mg\u00b7h/L; peak ${peak} mg/L; trough ${trough} mg/L.`,
    ...(auc_range_status !== "in_range" ? [`** AUC24 ${auc_range_status === "below_target" ? "BELOW" : "ABOVE"} TARGET (400\u2013600 mg\u00b7h/L) **`] : []),
    ...(arc_advisory ? [`** POSSIBLE ARC: ${arc_advisory.crcl_indexed_ml_min_1_73 ?? arc_advisory.crcl_ml_min} mL/min${arc_advisory.crcl_indexed_ml_min_1_73 ? "/1.73 m²" : " absolute"} vs threshold ${ARC_THRESHOLD_ML_MIN_1_73}. Confirm with measured 8–24 h urinary CrCl before acting. **`] : []),
    ...(safeInfusion.safety_note ? [safeInfusion.safety_note] : []),
    `SCr: ${prior.scr} mg/dL (${modelLabel} renal covariate). Adult prior model: ${modelLabel} two-compartment population prior.`,
    `If rapid empiric attainment is clinically necessary under local practice, an optional actual-body-weight loading-dose estimate around ${loadingDose.suggested_dose_mg} mg may be considered (${loadingDose.basis}).`,
    "Limitations: no measured levels; reassess when levels are available. Do not overinterpret prior-only outputs as patient-specific precision.",
  ].join("\n");

  const review_status = buildInitialRegimenReviewStatus();

  const caution_flags = [
    "No posterior refinement from measured levels was applied.",
    "Loading-dose language is optional generic empiric support, not patient-specific severity logic.",
    ...(auc_range_status === "below_target"
      ? ["AUC24 is BELOW the target range of 400\u2013600 mg\u00b7h/L \u2014 clinical review required."]
      : []),
    ...(arc_advisory ? ["Possible augmented renal clearance \u2014 confirm with a measured urinary creatinine clearance; estimating equations detect it poorly."] : []),
    ...(bmiAdvisory ? ["High body size: evidence for the Colin 2019 model at BMI 40 or more is limited \u2014 obtain early levels."] : []),
    "Review assumptions, scope exclusions, and local protocol before acting.",
  ];

  return {
    recommendation_type: "initial_regimen",
    auc24,
    peak,
    trough,
    auc_range_status,
    arc_advisory,
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
    parameter_uncertainty: summarizeParameterUncertainty(parameterUncertainty),
    calculation_details: {
      method: "Adult prior model only in a two-compartment intermittent steady-state maintenance-selection workflow",
      evidence_strength: "patient characteristics only",
      data_quality_summary: "No measured levels entered; the estimate rests on the population model and the patient characteristics only.",
      review_status,
      key_inputs: [
        `SCr ${prior.scr} mg/dL (${modelLabel} renal covariate)`,
        `Weight ${patient.weight_kg} kg`,
        `Safety infusion duration ${safeInfusion.infusion_duration_hours} h`,
        ...(displayCrCl ? [displayCrCl.label] : []),
      ],
      caution_flags,
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
      pk_model_name: prior.model_name,
      ffm_kg: prior.ffm_kg,
    },
  };
}

/**
 * @safety-checked-via: self (refusal IS the safety response)
 *
 * Build the InitialRegimenResult emitted when the empiric search returned no
 * safe candidate. The recommendation is a single pulse dose followed by a
 * measured level — the same workflow that vancomycin dosing protocols specify
 * for severe renal impairment without dialysis.
 *
 * Sentinel-safe values are populated for the standard fields (recommended_dose,
 * recommended_interval_hours, auc24, peak, trough) so downstream consumers that
 * don't yet handle empiric_dosing_blocked don't crash. The UI MUST gate on
 * empiric_dosing_blocked being present and render the pulse-dose safety state
 * instead of those sentinel values.
 */
function buildEmpiricRefusalResult(args: {
  patient: Patient;
  prior: { CL: number; V1: number; Q: number; V2: number; scr: number; model_name: "colin_2019" | "vancomyzer_obesity"; ffm_kg?: number };
  loadingDose: { suggested_dose_mg: number; basis: string };
}): InitialRegimenResult {
  const { patient, prior, loadingDose } = args;
  const modelLabel = modelShortName(prior.model_name);
  const displayCrCl = displayedCrCl(patient);
  const pulseMg = loadingDose.suggested_dose_mg;

  const safety_message =
    `Empiric fixed-interval dosing is not safe for this patient. ` +
    `Estimated clearance is ${prior.CL.toFixed(2)} L/h (${modelLabel} prior with SCr ${prior.scr} mg/dL, ` +
    `age ${patient.age}, weight ${patient.weight_kg} kg) — every regimen in the q6/q8/q12/q24 search ` +
    `space at the 500 mg minimum dose would exceed the AUC₂₄ ceiling of ${MAX_AUC24_MG_H_L} mg·h/L ` +
    `or the trough cap of ${MAX_TROUGH_MCG_ML} mg/L. ` +
    `Recommended action: give a single pulse dose of ${pulseMg} mg (${loadingDose.basis}) infused over ` +
    `${Math.max(1, Math.ceil((pulseMg / 10) / 60 * 4) / 4)} hours, then draw a vancomycin level and ` +
    `switch to the 1 Level tab for level-guided maintenance redosing.`;

  const interpretation_summary = safety_message;

  const assumptions = [
    `${modelLabel} two-compartment population prior used for clearance estimation.`,
    "Empiric search constrained to q6/q8/q12/q24 intervals with dose ≥ 500 mg per institutional safety floor.",
    `No regimen in this search space simultaneously satisfies the AUC₂₄ ≤ ${MAX_AUC24_MG_H_L} mg·h/L ceiling, trough ≤ ${MAX_TROUGH_MCG_ML} mg/L cap, peak ≤ ${MAX_PEAK_MCG_ML} mg/L cap, and TDD safety cap for this patient.`,
    "Pulse-dose-then-level is the standard workflow when fixed-interval empiric dosing is unsafe.",
  ];

  const limitations = [
    "Empiric workflow is refused for this patient — the prior estimates severe renal impairment with prolonged elimination half-life.",
    "No fixed-interval regimen is emitted because the calculator cannot identify a candidate within the AUC and trough safety windows.",
    "Pulse-dose value shown is a weight-based estimate (15–20 mg/kg, capped at 3000 mg); confirm dosing against institutional protocol and patient-specific factors before administration.",
    "After the pulse dose, draw a level (typically at 24–48 h depending on estimated half-life) and use the 1 Level tab to compute level-guided redose timing.",
  ];

  const quick_summary = [
    `Empiric dosing refused — estimated CL ${prior.CL.toFixed(2)} L/h.`,
    `Recommended: pulse dose ${pulseMg} mg × 1, then draw level + switch to the 1 Level tab.`,
    `SCr ${prior.scr} mg/dL; ${modelLabel} prior.`,
  ].join("\n");

  const clinical_note = [
    "Vancomycin: empiric fixed-interval dosing refused by calculator.",
    `Estimated CL ${prior.CL.toFixed(2)} L/h (${modelLabel} prior; SCr ${prior.scr} mg/dL, age ${patient.age}, weight ${patient.weight_kg} kg).`,
    `No regimen in the q6/q8/q12/q24 search space at the 500 mg dose floor passes the AUC₂₄ ≤ ${MAX_AUC24_MG_H_L} mg·h/L, trough ≤ ${MAX_TROUGH_MCG_ML} mg/L, and peak ≤ ${MAX_PEAK_MCG_ML} mg/L safety filters.`,
    `Recommended action: pulse dose ${pulseMg} mg × 1 (${loadingDose.basis}), then draw a vancomycin level and use the 1 Level tab for level-guided redose timing.`,
    "** EMPIRIC FIXED-INTERVAL DOSING NOT RECOMMENDED — USE PULSE-THEN-LEVEL WORKFLOW **",
  ].join("\n");

  // "caution" is the highest-severity level in the ReviewStatus enum; the
  // banner_title makes the refusal explicit.
  const review_status = {
    level: "caution" as const,
    workflow_fit: "single_level" as const,
    banner_title: "Empiric dosing refused — pulse-then-level required",
    banner_body:
      "The estimated PK profile makes fixed-interval empiric dosing unsafe. Give a single pulse dose, draw a level, and use the 1 Level tab to compute level-guided redose timing.",
    next_actions: [
      `Give ${pulseMg} mg pulse dose × 1 (${loadingDose.basis}).`,
      "Draw a vancomycin level (timing per estimated half-life).",
      "Switch to the 1 Level tab and enter the measured level to compute level-guided redose timing.",
    ],
  };

  return {
    recommendation_type: "initial_regimen",
    auc24: 0,
    peak: 0,
    trough: 0,
    auc_range_status: "below_target",
    recommended_dose: "—",
    recommended_interval_hours: 0,
    recommended_infusion_duration_hours: 0,
    interpretation_summary,
    assumptions,
    limitations,
    curve: [],
    measured_levels: [],
    frequency_options: [],
    calculation_details: {
      method: "Empiric search returned no safe candidate; pulse-then-level workflow recommended",
      evidence_strength: "patient characteristics only — regimen refused",
      data_quality_summary: "No fixed-interval regimen is emitted; the recommendation is a single pulse dose followed by a measured level.",
      review_status,
      key_inputs: [
        `SCr ${prior.scr} mg/dL (${modelLabel} renal covariate)`,
        `Weight ${patient.weight_kg} kg`,
        `Estimated CL ${prior.CL.toFixed(2)} L/h`,
        ...(displayCrCl ? [displayCrCl.label] : []),
      ],
      caution_flags: [
        "Empiric fixed-interval dosing refused — pulse-then-level workflow required.",
        "Severe renal impairment estimated by the population prior.",
        "Confirm pulse-dose value against institutional protocol before administration.",
      ],
    },
    documentation_preview: { quick_summary, clinical_note },
    pk_parameters: {
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      used_posterior_refinement: false,
      scr: prior.scr,
      age: patient.age,
      weight_kg: patient.weight_kg,
      pk_model_name: prior.model_name,
      ffm_kg: prior.ffm_kg,
    },
    empiric_dosing_blocked: {
      reason: `No safe fixed-interval regimen at the q6/q8/q12/q24 × ≥500 mg search grid. Estimated CL ${prior.CL.toFixed(2)} L/h.`,
      recommended_pulse_dose_mg: pulseMg,
      safety_message,
      estimated_cl_l_h: Math.round(prior.CL * 100) / 100,
    },
  };
}
