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
  height_cm: number;
  sex: "male" | "female" | "";
  serum_creatinine_mg_dl: number;
}

export type AucRangeStatus = "in_range" | "below_target" | "above_target";

export interface ArcAdvisory {
  detected: boolean;
  crcl_ml_min?: number;
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

// Max TDD safety cap per ASHP/IDSA 2020 guidelines: 4500 mg/day hard ceiling
function getMaxTdd(scr: number): number {
  if (scr >= 3.5) return 1000;   // severely impaired
  if (scr >= 2.0) return 2000;   // moderately impaired
  if (scr >= 1.3) return 3000;   // mildly impaired
  return 4500;                    // normal renal function — guideline max
}

const MAX_PEAK_MCG_ML = 80;
const MAX_TROUGH_MCG_ML = 25;

// CrCl estimation for ARC detection (Cockcroft-Gault)
function estimateCrCl(age: number, weight_kg: number, scr: number, sex: "male" | "female" | ""): number {
  if (age <= 0 || weight_kg <= 0 || scr <= 0) return 0;
  const base = ((140 - age) * weight_kg) / (72 * scr);
  return sex === "female" ? base * 0.85 : base;
}

function chooseInitialCandidate(CL: number, V1: number, Q: number, V2: number, scr: number) {
  const candidates: {
    dose_mg: number;
    interval_hours: number;
    auc24: number;
    peak: number;
    trough: number;
    inRange: boolean;
  }[] = [];

  const maxTdd = getMaxTdd(scr);

  for (const interval_hours of INTERVAL_OPTIONS_H) {
    for (const dose_mg of DOSE_OPTIONS_MG) {
      if (dose_mg > MAX_SINGLE_DOSE_MG) continue;
      const tdd = (dose_mg * 24) / interval_hours;
      if (tdd > maxTdd) continue;
      const infDuration = computeSafeInfusionDurationHours(dose_mg).infusion_duration_hours;
      // Infusion must not exceed 2/3 of the dosing interval
      if (infDuration > interval_hours * 0.67) continue;
      const exposure = simulateCandidateExposure(CL, V1, Q, V2, {
        dose_mg,
        interval_hours,
        infusion_duration_hours: infDuration,
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
    // Prefer longer intervals (less burden) when AUC is comparable
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
    `Prior-based first-pass estimate: AUC24 ${opt.auc24} mg\u00b7h/L; peak ${opt.peak} mcg/mL; trough ${opt.trough} mcg/mL. ` +
    `SCr ${ctx.scr} mg/dL (${ctx.modelLabel} renal covariate).` +
    (ctx.ffm_kg ? ` FFM ${ctx.ffm_kg.toFixed(1)} kg (Janmahasatian 2005) \u2014 V1 and V2 scaled to FFM.` : "") +
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

export function computeInitialRegimen(patient: Patient): InitialRegimenResult {
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

  const { best: choice, candidates } = chooseInitialCandidate(prior.CL, prior.V1, prior.Q, prior.V2, prior.scr);
  const loadingDose = buildEmpiricLoadingDose({ actual_body_weight_kg: patient.weight_kg });

  // ─── SAFETY REFUSAL PATH ──────────────────────────────────────────
  // The empiric search returned no candidate that simultaneously meets
  // the TDD cap, peak cap (80 mcg/mL), and trough cap (25 mcg/mL). For
  // any patient where the steady-state PK math says no fixed-interval
  // regimen at q6/q8/q12/q24 with dose ≥ 500 mg is safe (typically
  // severe renal impairment, CL < ~0.5 L/h, t½ > 50 h), we MUST NOT
  // silently emit a guessed regimen. Refuse the empiric workflow and
  // direct the clinician to pulse-dose-then-level.
  if (choice == null) {
    return buildEmpiricRefusalResult({
      patient,
      prior,
      loadingDose,
    });
  }

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
    }
  );

  const recommended_dose = `${choice.dose_mg} mg`;
  const auc24 = Math.round(choice.auc24 * 10) / 10;
  const peak = Math.round(choice.peak * 10) / 10;
  const trough = Math.round(choice.trough * 10) / 10;

  const auc_range_status = getAucRangeStatus(auc24);

  // ARC detection
  const crcl = estimateCrCl(patient.age, patient.weight_kg, patient.serum_creatinine_mg_dl, patient.sex || "male");
  const required_tdd = TARGET_AUC24_MID * prior.CL;
  const isArc = crcl > 150 && auc_range_status === "below_target";

  let arc_advisory: ArcAdvisory | undefined;
  if (isArc) {
    const ci_rate = Math.round(TARGET_AUC24_MID * prior.CL / 24 * 10) / 10;
    arc_advisory = {
      detected: true,
      crcl_ml_min: Math.round(crcl),
      cl_l_h: Math.round(prior.CL * 10) / 10,
      required_tdd_mg: Math.round(required_tdd),
      continuous_infusion_rate_mg_h: ci_rate,
      message:
        `Augmented renal clearance detected (CrCl ${Math.round(crcl)} mL/min, CL ${prior.CL.toFixed(1)} L/h). ` +
        `Standard intermittent dosing cannot achieve target AUC24 of 400\u2013600 mg\u00b7h/L. ` +
        `Required TDD \u2248 ${Math.round(required_tdd).toLocaleString()} mg/day. ` +
        `Consider continuous IV infusion (~${ci_rate} mg/h with loading dose) or consult Infectious Diseases/nephrology. ` +
        `Obtain two vancomycin levels early (2\u20134h and 6\u20138h post-dose) to confirm individual PK.`,
    };
  }

  const modelLabel = prior.model_name === "vancomyzer_obesity"
    ? "Vancomyzer Obesity Model (Smit 2020 + Zhang 2023)"
    : "Colin 2019";

  const arcNote = arc_advisory
    ? ` WARNING: Augmented renal clearance detected (CrCl ${arc_advisory.crcl_ml_min} mL/min). Target AUC may not be achievable with standard intermittent dosing — consider continuous infusion.`
    : "";

  const freqCtx: FrequencyOptionContext = {
    scr: prior.scr,
    modelLabel,
    ffm_kg: prior.ffm_kg,
    loadingDoseMg: loadingDose.suggested_dose_mg,
    loadingDoseBasis: loadingDose.basis,
    arcNote,
  };
  const frequencyOptions = buildFrequencyOptions(candidates, choice, prior.CL, prior.V1, prior.Q, prior.V2, freqCtx);

  const belowTargetNote = (!arc_advisory && auc_range_status === "below_target")
    ? ` NOTE: Best available regimen achieves AUC24 ${auc24} mg\u00b7h/L, which is below the target range of 400\u2013600. Clinical review is required.`
    : "";

  const interpretation_summary =
    `Initial regimen suggestion: ${recommended_dose} every ${choice.interval_hours} hours infused over ${safeInfusion.infusion_duration_hours} hours. ` +
    `Prior-based first-pass estimate: AUC24 ${auc24} mg\u00b7h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL. ` +
    `SCr ${prior.scr} mg/dL (${modelLabel} renal covariate).` +
    (prior.ffm_kg ? ` FFM ${prior.ffm_kg.toFixed(1)} kg (Janmahasatian 2005) \u2014 V1 and V2 scaled to FFM.` : "") +
    arcNote + belowTargetNote +
    ` If immediate severe-infection coverage is clinically necessary under local practice, a clinician may optionally consider an empiric loading-dose estimate around ${loadingDose.suggested_dose_mg} mg (${loadingDose.basis}) before maintenance dosing. ` +
    `${safeInfusion.safety_note ? `${safeInfusion.safety_note} ` : ""}` +
    `No measured levels; re-evaluate after levels are available. Intended to support review, not replace clinician judgment.`;

  const assumptions = [
    prior.model_name === "vancomyzer_obesity"
      ? "Obesity model (Smit 2020 + Zhang 2023): V1 and V2 scaled to FFM (Janmahasatian 2005). CL uses TBW-based CrCl (Cockcroft-Gault)."
      : "Serum creatinine (SCr) is used directly as the renal covariate in the Colin 2019 model \u2014 Cockcroft-Gault CrCl estimation is NOT used. CL scales with (0.83/SCr)^0.80 per the Colin 2019 published equations.",
    `Adult prior model explicit in code: ${modelLabel} two-compartment population prior.`,
    "Initial regimen chosen from practical dose/interval candidates using the shared two-compartment steady-state PK model.",
    "AUC24 = (dose \u00d7 24/\u03c4) / CL at steady state \u2014 standard linear PK relationship.",
    "Infusion duration constrained to a minimum of 60 minutes and a maximum rate of 10 mg/min in line with FDA labeling and guideline-based safety framing.",
    "Empiric loading-dose note, when shown, is a capped actual-body-weight estimate for clinician consideration and does not encode severity, indication, or critical-illness context.",
    "No measured vancomycin levels; no posterior or Bayesian update.",
  ];

  const limitations = [
    "First-pass adult prior estimate only; no measured levels are available to individualize PK.",
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
    `Prior-based estimate: AUC24 ${auc24} mg\u00b7h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL`,
    ...(auc_range_status !== "in_range" ? [`AUC24 STATUS: ${auc_range_status === "below_target" ? "BELOW TARGET" : "ABOVE TARGET"}`] : []),
    ...(safeInfusion.safety_note ? [safeInfusion.safety_note] : []),
    `SCr: ${prior.scr} mg/dL (${modelLabel} renal covariate). Loading-dose considerations are optional, generic empiric support only, and should be reviewed separately from the maintenance suggestion. Assumptions and limitations apply.`,
  ].join("\n");

  const clinical_note = [
    "Vancomycin initial regimen suggestion (no levels).",
    `Dose: ${recommended_dose}; Interval: every ${choice.interval_hours} hours; Infusion: ${safeInfusion.infusion_duration_hours} hours.`,
    `Prior-based estimate: AUC24 ${auc24} mg\u00b7h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL.`,
    ...(auc_range_status !== "in_range" ? [`** AUC24 ${auc_range_status === "below_target" ? "BELOW" : "ABOVE"} TARGET (400\u2013600 mg\u00b7h/L) **`] : []),
    ...(arc_advisory ? [`** ARC DETECTED: CrCl ${arc_advisory.crcl_ml_min} mL/min. Consider continuous infusion ~${arc_advisory.continuous_infusion_rate_mg_h} mg/h. **`] : []),
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
    ...(arc_advisory ? ["Augmented renal clearance detected \u2014 standard intermittent dosing may be inadequate."] : []),
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
    calculation_details: {
      method: "Adult prior model only in a two-compartment intermittent steady-state maintenance-selection workflow",
      evidence_strength: "population prior only",
      data_quality_summary: "No measured levels entered; workflow fit depends on population-prior assumptions and patient-characteristic inputs only.",
      review_status,
      key_inputs: [
        `SCr ${prior.scr} mg/dL (${modelLabel} renal covariate)`,
        `Weight ${patient.weight_kg} kg`,
        `Safety infusion duration ${safeInfusion.infusion_duration_hours} h`,
        ...(crcl > 0 ? [`Estimated CrCl ${Math.round(crcl)} mL/min`] : []),
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
  const modelLabel = prior.model_name === "vancomyzer_obesity"
    ? "Vancomyzer Obesity Model (Smit 2020 + Zhang 2023)"
    : "Colin 2019";
  const crcl = estimateCrCl(patient.age, patient.weight_kg, patient.serum_creatinine_mg_dl, patient.sex || "male");
  const pulseMg = loadingDose.suggested_dose_mg;

  const safety_message =
    `Empiric fixed-interval dosing is not safe for this patient. ` +
    `Estimated clearance is ${prior.CL.toFixed(2)} L/h (${modelLabel} prior with SCr ${prior.scr} mg/dL, ` +
    `age ${patient.age}, weight ${patient.weight_kg} kg) — every regimen in the q6/q8/q12/q24 search ` +
    `space at the 500 mg minimum dose would exceed the AUC₂₄ ceiling of 600 mg·h/L or the trough ` +
    `cap of 25 mcg/mL. ` +
    `Recommended action: give a single pulse dose of ${pulseMg} mg (${loadingDose.basis}) infused over ` +
    `${Math.max(1, Math.ceil((pulseMg / 10) / 60 * 4) / 4)} hours, then draw a vancomycin level and ` +
    `switch to the 1-Level workflow for level-guided maintenance redosing.`;

  const interpretation_summary = safety_message;

  const assumptions = [
    `${modelLabel} two-compartment population prior used for clearance estimation.`,
    "Empiric search constrained to q6/q8/q12/q24 intervals with dose ≥ 500 mg per institutional safety floor.",
    "No regimen in this search space simultaneously satisfies the AUC₂₄ ≤ 600 mg·h/L ceiling, trough ≤ 25 mcg/mL cap, and TDD safety cap for this patient.",
    "Pulse-dose-then-level is the standard workflow when fixed-interval empiric dosing is unsafe.",
  ];

  const limitations = [
    "Empiric workflow is refused for this patient — the prior estimates severe renal impairment with prolonged elimination half-life.",
    "No fixed-interval regimen is emitted because the engine cannot identify a candidate within the AUC and trough safety windows.",
    "Pulse-dose value shown is a weight-based estimate (15–20 mg/kg, capped at 3000 mg); confirm dosing against institutional protocol and patient-specific factors before administration.",
    "After the pulse dose, draw a level (typically at 24–48 h depending on estimated half-life) and use the 1-Level workflow to compute level-guided redose timing.",
  ];

  const quick_summary = [
    `Empiric dosing refused — estimated CL ${prior.CL.toFixed(2)} L/h.`,
    `Recommended: pulse dose ${pulseMg} mg × 1, then draw level + switch to 1-Level workflow.`,
    `SCr ${prior.scr} mg/dL; ${modelLabel} prior.`,
  ].join("\n");

  const clinical_note = [
    "Vancomycin: empiric fixed-interval dosing refused by calculator.",
    `Estimated CL ${prior.CL.toFixed(2)} L/h (${modelLabel} prior; SCr ${prior.scr} mg/dL, age ${patient.age}, weight ${patient.weight_kg} kg).`,
    "No regimen in the q6/q8/q12/q24 search space at the 500 mg dose floor passes the AUC₂₄ ≤ 600 mg·h/L and trough ≤ 25 mcg/mL safety filters.",
    `Recommended action: pulse dose ${pulseMg} mg × 1 (${loadingDose.basis}), then draw a vancomycin level and use the 1-Level workflow for level-guided redose timing.`,
    "** EMPIRIC FIXED-INTERVAL DOSING NOT RECOMMENDED — USE PULSE-THEN-LEVEL WORKFLOW **",
  ].join("\n");

  // "caution" is the highest-severity level in the ReviewStatus enum; the
  // banner_title makes the refusal explicit.
  const review_status = {
    level: "caution" as const,
    workflow_fit: "single_level" as const,
    banner_title: "Empiric dosing refused — pulse-then-level required",
    banner_body:
      "The estimated PK profile makes fixed-interval empiric dosing unsafe. Give a single pulse dose, draw a level, and use the 1-Level workflow to compute level-guided redose timing.",
    next_actions: [
      `Give ${pulseMg} mg pulse dose × 1 (${loadingDose.basis}).`,
      "Draw a vancomycin level (timing per estimated half-life).",
      "Switch to the 1-Level workflow and enter the measured level to compute level-guided redose timing.",
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
      evidence_strength: "population prior only — empiric refusal",
      data_quality_summary: "No fixed-interval regimen is emitted; the recommendation is a single pulse dose followed by a measured level.",
      review_status,
      key_inputs: [
        `SCr ${prior.scr} mg/dL (${modelLabel} renal covariate)`,
        `Weight ${patient.weight_kg} kg`,
        `Estimated CL ${prior.CL.toFixed(2)} L/h`,
        ...(crcl > 0 ? [`Estimated CrCl ${Math.round(crcl)} mL/min`] : []),
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
