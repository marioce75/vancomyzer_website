"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import FeatureGate from "@/components/FeatureGate";
import type {
  CalculatorMode,
  CalculateRequest,
  CalculateResponse,
  CalculateErrorResponse,
  CalculateRequestRegimen,
  CalculateRequestPatient,
  FrequencyOption,
} from "@/types/calculator";
import type { BedboundDoseData } from "@/components/calculator/BedboundAdvisoryPanel";
import CalculatorHeader from "@/components/calculator/CalculatorHeader";
import CalculatorLayout from "@/components/calculator/CalculatorLayout";
import PatientCharacteristicsForm from "@/components/calculator/PatientCharacteristicsForm";
import CalculationMethodPanel from "@/components/calculator/CalculationMethodPanel";
import RegimenForm from "@/components/calculator/RegimenForm";
import LevelEntryTable, { manualHoursCollectionTime } from "@/components/calculator/LevelEntryTable";
import CalculatorActionBar from "@/components/calculator/CalculatorActionBar";
import PrimaryMetricsCard from "@/components/calculator/PrimaryMetricsCard";
import DoseRecommendationCard, { LoadingDosePopover } from "@/components/calculator/DoseRecommendationCard";
import TeachingNote from "@/components/calculator/TeachingNote";
import Advisory from "@/components/calculator/Advisory";
import InputSection from "@/components/calculator/InputSection";
import RegimenComparisonTable from "@/components/calculator/RegimenComparisonTable";
import ResultDetailTabs from "@/components/calculator/ResultDetailTabs";
import InterpretationSummaryCard from "@/components/calculator/InterpretationSummaryCard";
import LimitationsCard from "@/components/calculator/LimitationsCard";
import ConcentrationTimeGraph from "@/components/calculator/ConcentrationTimeGraph";
import CalculatorErrorState from "@/components/calculator/CalculatorErrorState";
import SettingsPanel from "@/components/calculator/SettingsPanel";
import DisclaimerModal from "@/components/calculator/DisclaimerModal";
import PKParametersMath from "@/components/calculator/PKParametersMath";
import NoteExportGate from "@/components/calculator/NoteExportGate";
import PdfExportGate from "@/components/calculator/PdfExportGate";
import UpgradeBanner from "@/components/UpgradeBanner";
import { useMatrixSettings } from "@/contexts/MatrixSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/hooks/useFeature";
import { printReport, type ReportData } from "@/lib/generateReport";
import { track } from "@/lib/analytics";
import { parseClinicalNumber } from "@/lib/parseClinicalNumber";
import { COLIN_2019, modelDisplayName, modelShortName } from "@/lib/pk/modelRegistry";
import { fmt } from "@/lib/formatNumber";
const defaultPatient: CalculateRequestPatient = { age: 0, weight_kg: 0, height_cm: 0, sex: "", serum_creatinine_mg_dl: 0 };
const defaultRegimen: CalculateRequestRegimen = { dose_mg: 0, interval_hours: 0, infusion_duration_hours: 0, steady_state_confirmed: false };
const defaultLevel = { value_mcg_ml: 0, collection_time: "", time_since_last_dose_hours: 0 };

type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

type BandUncertaintyLabel = "population_only" | "low" | "moderate" | "high" | "very_high";

/** Narrowest to widest, matching the fixed band widths in ConcentrationTimeGraph (10, 18, 28, 35, 40%). */
const BAND_WIDTH_ORDER: readonly BandUncertaintyLabel[] = ["low", "moderate", "high", "population_only", "very_high"];

function widerBandLabel(a: BandUncertaintyLabel, b: BandUncertaintyLabel): BandUncertaintyLabel {
  return BAND_WIDTH_ORDER.indexOf(a) >= BAND_WIDTH_ORDER.indexOf(b) ? a : b;
}

function isBandUncertaintyLabel(value: unknown): value is BandUncertaintyLabel {
  return typeof value === "string" && (BAND_WIDTH_ORDER as readonly string[]).includes(value);
}

/**
 * Uncertainty label for the illustrative band on the concentration-time graph.
 * Presentation only; the band is never narrower than the engine's own
 * posterior_fit.uncertainty_label.
 *
 * - The response now carries posterior_fit, so its uncertainty_label is used
 *   directly and widened for a weak or prior-only fit.
 * - The reconstruction below is the fallback for a response without it (a
 *   result restored from an older session snapshot): no posterior refinement →
 *   population_only; "multiple coherent levels" (fit_quality and uncertainty
 *   both "moderate") → moderate; any other fitted result → high. The engine
 *   never labels a fit "low", so the number of levels alone never narrows the
 *   band.
 * - Fit-quality warnings keep the band at "high" or wider.
 */
function deriveBandUncertaintyLabel(result: CalculateResponse): BandUncertaintyLabel {
  const posteriorFit = (result as unknown as { posterior_fit?: { uncertainty_label?: unknown; fit_quality?: unknown } }).posterior_fit;
  let label: BandUncertaintyLabel;
  if (posteriorFit && isBandUncertaintyLabel(posteriorFit.uncertainty_label)) {
    label = posteriorFit.uncertainty_label;
    if (posteriorFit.fit_quality === "weak") label = widerBandLabel(label, "high");
    if (posteriorFit.fit_quality === "prior_only" || posteriorFit.fit_quality === "not_applicable") {
      label = widerBandLabel(label, "population_only");
    }
  } else if (!result.pk_parameters?.used_posterior_refinement) {
    label = "population_only";
  } else if (result.calculation_details?.evidence_strength === "multiple coherent levels") {
    label = "moderate";
  } else {
    label = "high";
  }
  if ((result.fit_quality_warnings?.length ?? 0) > 0) label = widerBandLabel(label, "high");
  return label;
}

function hasPatientCoreData(patient: typeof defaultPatient): boolean {
  return (
    patient.age > 0 &&
    patient.weight_kg > 0 &&
    patient.serum_creatinine_mg_dl > 0
  );
}

function getModeScopedFieldErrors(mode: CalculatorMode, fieldErrors?: Record<string, string>): Record<string, string> {
  if (!fieldErrors) return {};
  if (mode === "initial_regimen") {
    return Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => key.startsWith("patient.")));
  }
  return fieldErrors;
}

/** True when the viewport matches `query`; false during SSR and before mount. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

const SESSION_KEY = "vancomyzer_calculator_state";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export default function CalculatorWorkspace() {
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("empiric");
  const [mode, setMode] = useState<CalculatorMode>("initial_regimen");
  const [patient, setPatient] = useState<CalculateRequestPatient>(defaultPatient);
  const [rrt, setRrt] = useState<boolean | null>(null);
  const [regimen, setRegimen] = useState<CalculateRequestRegimen>(defaultRegimen);
  const [levels, setLevels] = useState<(typeof defaultLevel)[]>([{ ...defaultLevel }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CalculateErrorResponse | null>(null);
  const [result, setResult] = useState<CalculateResponse | null>(null);

  const [bedbound, setBedbound] = useState(false);
  const [bedboundDoseData, setBedboundDoseData] = useState<BedboundDoseData | null>(null);

  const [lastInputChangedAt, setLastInputChangedAt] = useState<number | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<number | null>(null);
  const [selectedFrequencyOption, setSelectedFrequencyOption] = useState<FrequencyOption | null>(null);
  // Existing-regimen path only: view the CURRENT regimen (as entered) instead
  // of the engine's recommendation. The response's top-level auc24/peak/trough
  // and curve describe the current regimen; frequency_options carry their own.
  const [viewCurrentRegimen, setViewCurrentRegimen] = useState(false);
  // Pulse-dose only: lets the user flip the chart between their entered
  // regimen (default) and the engine's auto-recommended adjustment.
  const [showEngineRecommended, setShowEngineRecommended] = useState(false);

  // Snapshot of state before loading dose simulation — enables undo
  const preLoadingDoseState = useRef<{
    viewMode: WorkspaceViewMode;
    mode: CalculatorMode;
    regimen: CalculateRequestRegimen;
    levels: (typeof defaultLevel)[];
    result: CalculateResponse | null;
    selectedFrequencyOption: FrequencyOption | null;
  } | null>(null);

  // Optional clinician-supplied tracking string for calculation history.
  // Persisted only if the user has the history.calculation feature (Pro+).
  // Held in a ref alongside state so updates don't churn the buildRequest
  // callback identity — if it did, every keystroke would retrigger the
  // auto-recalc useEffect and write a row per character typed.
  const [caseId, setCaseId] = useState<string>("");
  const caseIdRef = useRef<string>("");
  useEffect(() => { caseIdRef.current = caseId; }, [caseId]);
  const { allowed: canSaveHistory } = useFeature("history.calculation");

  // Layout State
  const [activeSection, setActiveSection] = useState<string>("patient");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const { playSound } = useMatrixSettings();
  // Desktop cockpit (≥1280px): the graph fills its panel beside the side rail
  // instead of using a fixed height.
  const graphFill = useMediaQuery("(min-width: 1280px)");
  const { user, loading: authLoading, logout } = useAuth();

  // Workflow label for the "Calculation Run" analytics event. Read through a
  // ref (like caseIdRef above) so handleCalculate's identity does not change
  // with the view mode — a new identity would re-fire the empiric
  // auto-recalc effect and send an extra request.
  const viewModeRef = useRef<WorkspaceViewMode>(viewMode);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  // When an anonymous visitor hits the calculation rate limit (HTTP 429), the
  // debounced empiric auto-recalc must stop firing until the limit lifts —
  // otherwise every keystroke keeps sending requests into the limiter. Set
  // from the Retry-After header; explicit Calculate clicks are not blocked.
  const rateLimitedUntilRef = useRef<number>(0);

  // Result lifecycle guard. Each submission takes a sequence number and the
  // timestamp of the inputs it was built from. A response is applied only if it
  // is the LATEST submission; an older response that completes late is
  // discarded, so it can never overwrite a newer input, clear an RRT block or
  // resurrect a superseded regimen. lastCalculatedAt is set to the SUBMIT time
  // (not the response time), so inputs edited while the request was in flight
  // still read as stale.
  const requestSeqRef = useRef(0);
  const rrtRef = useRef<boolean | null>(null);
  useEffect(() => { rrtRef.current = rrt; }, [rrt]);

  // ── Restore from sessionStorage on mount (client-only) ──
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Date.now() - (s.timestamp ?? 0) > EIGHT_HOURS) {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      if (s.patient) setPatient(s.patient);
      if (s.rrt !== undefined) setRrt(s.rrt);
      if (s.regimen) setRegimen(s.regimen);
      if (s.levels) setLevels(s.levels);
      if (s.bedbound !== undefined) setBedbound(s.bedbound);
      if (s.viewMode) setViewMode(s.viewMode);
      if (s.mode) setMode(s.mode);
      if (s.activeSection) setActiveSection(s.activeSection);
      if (s.result) {
        setResult(s.result);
        setLastCalculatedAt(Date.now());
      }
      if (s.selectedFrequencyOption) setSelectedFrequencyOption(s.selectedFrequencyOption);
    } catch { /* corrupted — ignore */ }
  }, []);

  // ── Persist to sessionStorage on every relevant state change ──
  const hasMountedRef = useRef(false);
  useEffect(() => {
    // Skip first render to avoid saving defaults before restore runs
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        patient, rrt, regimen, levels, bedbound,
        viewMode, mode, activeSection,
        result, selectedFrequencyOption,
        timestamp: Date.now(),
      }));
    } catch { /* storage full — ignore */ }
  }, [patient, rrt, regimen, levels, bedbound, viewMode, mode, activeSection, result, selectedFrequencyOption]);

  // Pre-fill patient state from URL query params (overrides session restore)
  const didPreFillRef = useRef(false);
  // Literature Reproducibility case loaded via ?case=<id>; banner stays
  // visible until the user resets or dismisses.
  const [loadedCase, setLoadedCase] = useState<{ id: string; reference: string } | null>(null);
  useEffect(() => {
    if (didPreFillRef.current) return;

    // (1) Literature Reproducibility case deep-link — takes precedence over scalar params
    const caseId = searchParams.get("case");
    if (caseId) {
      // Lazy import keeps the case registry out of the calculator's initial bundle.
      void import("@/lib/validation/registry").then(({ getCaseById }) => {
        const c = getCaseById(caseId);
        if (!c) return;
        didPreFillRef.current = true;
        // Set ALL patient fields so the calculator can run immediately.
        // RRT is forced to "no" because every published case in the registry
        // assumes normal renal handling — none involve dialysis or CRRT.
        setPatient((prev) => ({
          ...prev,
          age: c.patient.age_years,
          weight_kg: c.patient.weight_kg,
          serum_creatinine_mg_dl: c.patient.serum_creatinine_mg_dl,
          sex: c.patient.sex === "M" ? "male" : c.patient.sex === "F" ? "female" : prev.sex,
          height_cm: c.patient.height_cm ?? prev.height_cm,
        }));
        setRrt(false);
        // Mode selection:
        //   - empiric / prior_at_regimen → empiric mode (engine picks regimen;
        //     PK Parameters panel shows the prior's CL which is the matching point)
        //   - existing with levels → existing-regimen mode at the appropriate level count
        if (c.workflow_type === "empiric" || c.workflow_type === "prior_at_regimen") {
          applyViewMode("empiric");
        } else if (c.regimen) {
          const targetView: WorkspaceViewMode = c.levels.length >= 2 ? "two_levels" : "one_level";
          applyViewMode(targetView);
          setRegimen({
            dose_mg: c.regimen.dose_mg,
            interval_hours: c.regimen.interval_hours,
            infusion_duration_hours: c.regimen.infusion_duration_hours,
            doses_given: c.regimen.doses_given,
          });
          if (c.levels.length > 0) {
            // Synthesize ISO collection_time strings from time_since_last_dose_hours
            // so the 2-level validator (which requires collection_time and cross-
            // checks wall-clock delta against reported delta) doesn't reject the
            // pre-filled case. Anchor is an arbitrary epoch; the validator only
            // cares about deltas between collection times, not absolute values.
            // Assumes all levels share the same most-recent-dose (the common
            // peak+trough case Carreno 2017 documents).
            setLevels(
              c.levels.map((l) => ({
                value_mcg_ml: l.value_mcg_ml,
                // Same synthetic reference as manual-hours entry, so the level
                // table reopens these rows in manual-hours mode.
                collection_time: manualHoursCollectionTime(l.time_since_last_dose_hours),
                time_since_last_dose_hours: l.time_since_last_dose_hours,
              })),
            );
          }
        }
        setLoadedCase({ id: c.id, reference: c.source.specific_reference });
      });
      return;
    }

    // (2) Scalar pre-fill — existing behavior
    const age = searchParams.get("age");
    const weight = searchParams.get("weight_kg");
    const scr = searchParams.get("serum_creatinine_mg_dl");
    if (age && weight && scr) {
      const parsedAge = parseClinicalNumber(age);
      const parsedWeight = parseClinicalNumber(weight);
      const parsedScr = parseClinicalNumber(scr);
      if (parsedAge !== null && parsedWeight !== null && parsedScr !== null && parsedAge > 0 && parsedWeight > 0 && parsedScr > 0) {
        didPreFillRef.current = true;
        setPatient(prev => ({ ...prev, age: parsedAge, weight_kg: parsedWeight, serum_creatinine_mg_dl: parsedScr }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applyViewMode is intentionally not a dep; we want this to run once
  }, [searchParams]);

  const buildRequest = useCallback((): CalculateRequest => {
    const trimmedCaseId = caseIdRef.current.trim();
    const caseIdField = canSaveHistory && trimmedCaseId.length > 0 ? { case_id: trimmedCaseId } : {};
    // The RRT toggle was collected and stored but never sent, so the API could
    // not withhold a recommendation for dialysis / renal replacement therapy the
    // way this site says it does. Send it as part of the patient contract.
    const base = { mode, patient: { ...patient, dialysis_or_rrt: rrt === true }, ...caseIdField };
    if (mode === "initial_regimen") return base;
    // Drop only completely untouched rows (loading-dose simulation has no measured
    // levels). A row with a time but an unreadable/zero value is sent as-is so the
    // server rejects it visibly instead of silently fitting one level fewer.
    const validLevels = levels.filter(
      (l) => l.value_mcg_ml !== 0 || l.time_since_last_dose_hours !== 0 || (l.collection_time ?? "").trim() !== "",
    );
    return { ...base, regimen, levels: validLevels };
  }, [mode, patient, rrt, regimen, levels, canSaveHistory]);

  const applyViewMode = useCallback((next: WorkspaceViewMode) => {
    setViewMode(next);
    setError(null);
    setResult(null);
    setLastCalculatedAt(null);
    if (next === "empiric") {
      setMode("initial_regimen");
      setActiveSection("patient");
    } else {
      setMode("existing_regimen");
      setActiveSection("patient");
      setLevels((current) => {
        if (next === "one_level") return current.length ? [current[0]] : [{ ...defaultLevel }];
        if (current.length >= 2) return current;
        return [...current, { ...defaultLevel }];
      });
    }
  }, []);

  const handleCalculate = useCallback(async (opts?: { intent?: "auto" | "explicit" }) => {
    const intent = opts?.intent ?? "explicit";
    // Captured at submit time so switching modes mid-request can't mislabel the analytics event.
    const workflowMode = viewModeRef.current;
    playSound("calculate");
    setError(null);
    setLoading(true);
    const request = { ...buildRequest(), intent };
    const seq = ++requestSeqRef.current;
    const submittedAt = Date.now();

    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json().catch(() => ({}));

      // Superseded by a newer submission, or the patient was switched to RRT
      // while this request was in flight: discard, do not touch state.
      if (seq !== requestSeqRef.current || rrtRef.current === true) {
        return;
      }

      if (!res.ok) {
        if (res.status === 429) {
          // Pause auto-recalc for the server's Retry-After window (default 60 s
          // if the header is missing or unreadable).
          const retryAfterSec = Number(res.headers.get("retry-after"));
          const waitSec = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 60;
          rateLimitedUntilRef.current = Date.now() + waitSec * 1000;
        }
        const fieldErrorDetails = data.field_errors && typeof data.field_errors === "object"
          ? Object.entries(data.field_errors as Record<string, string>).map(([field, message]) => `${field}: ${message}`)
          : [];
        setResult(null);
        setError({
          // error_type may also be "rate_limited" (HTTP 429 for anonymous
          // visitors); it is only a label here — the visitor sees `message`.
          error_type: (data.error_type as CalculateErrorResponse["error_type"]) ?? "calculation_error",
          // A 429 normally carries a plain-language `message`; the 429 fallback
          // only covers a limiter response that arrives without a JSON body.
          message: typeof data.message === "string"
            ? data.message
            : res.status === 429
              ? "Too many calculations in a short time. Please wait a minute, then try again."
              : "Calculation request failed.",
          field_errors: data.field_errors,
          details: [...(Array.isArray(data.details) ? data.details : []), ...fieldErrorDetails],
          limitations: data.limitations,
          recovery_guidance: Array.isArray(data.recovery_guidance) ? data.recovery_guidance : [],
          fallback_workflow: data.fallback_workflow === "initial_regimen" || data.fallback_workflow === "repeat_existing_regimen_sampling" ? data.fallback_workflow : undefined,
        });
        playSound("error");
        return;
      }

      setResult({
        recommendation_type: data.recommendation_type === "existing_regimen" ? "existing_regimen" : "initial_regimen",
        auc24: data.auc24 ?? 0,
        peak: data.peak ?? 0,
        trough: data.trough ?? 0,
        recommended_dose: data.recommended_dose ?? "",
        recommended_interval_hours: data.recommended_interval_hours ?? 0,
        recommended_infusion_duration_hours: data.recommended_infusion_duration_hours,
        infusion_duration_adjusted_for_safety: data.infusion_duration_adjusted_for_safety,
        infusion_safety_note: data.infusion_safety_note,
        interpretation_summary: data.interpretation_summary ?? "",
        assumptions: Array.isArray(data.assumptions) ? data.assumptions : [],
        limitations: Array.isArray(data.limitations) ? data.limitations : [],
        curve: Array.isArray(data.curve) ? data.curve : [],
        measured_levels: Array.isArray(data.measured_levels) ? data.measured_levels : [],
        calculation_details: data.calculation_details,
        frequency_options: Array.isArray(data.frequency_options) ? data.frequency_options : [],
        documentation_preview: data.documentation_preview,
        pk_parameters: data.pk_parameters,
        empiric_dosing_blocked: data.empiric_dosing_blocked,
        adjustment_dosing_blocked: data.adjustment_dosing_blocked,
        // These four are safety surfaces the engine computes and this whitelist
        // used to drop, so the panels that render them could never fire: the
        // red augmented-renal-clearance card, the below-target banner, the
        // late-draw timing warnings and the poor-fit warning. The warning text
        // still reached clinicians through interpretation_summary and the
        // clinical note, but every dedicated panel was dead.
        arc_advisory: data.arc_advisory,
        auc_range_status: data.auc_range_status,
        timing_warnings: Array.isArray(data.timing_warnings) ? data.timing_warnings : undefined,
        fit_quality_warnings: Array.isArray(data.fit_quality_warnings) ? data.fit_quality_warnings : undefined,
        // The engine's fit diagnostic, so the graph band uses the engine's own
        // uncertainty label rather than a reconstruction.
        posterior_fit: data.posterior_fit,
        // Exposure of the regimen being recommended, distinct from auc24/peak/
        // trough, which on the adjustment path describe the current regimen.
        predicted_auc24: data.predicted_auc24,
        predicted_peak: data.predicted_peak,
        predicted_trough: data.predicted_trough,
        exposure_horizon: data.exposure_horizon,
        steady_state_exposure: data.steady_state_exposure,
        actual_history_exposure: data.actual_history_exposure,
        loading_dose_curve: Array.isArray(data.loading_dose_curve) ? data.loading_dose_curve : undefined,
        steady_state_approach: data.steady_state_approach,
        steady_state_warning: data.steady_state_warning,
        review_hold: data.review_hold,
        result_snapshot: data.result_snapshot,
      });
      setLastCalculatedAt(submittedAt);
      setSelectedFrequencyOption(null);
      setViewCurrentRegimen(false);
      setError(null);
      playSound("success");

      // Usage analytics — only calculations the clinician explicitly started
      // (Calculate button, Cmd/Ctrl+Enter, loading-dose simulation), never the
      // debounced empiric auto-recalc (intent "auto"). The only prop is the
      // workflow label; no patient inputs or results are ever sent.
      if (intent === "explicit") {
        track("Calculation Run", { mode: workflowMode });
      }

      // ── PK Validation audit log ──
      if (Array.isArray(data.curve) && data.curve.length > 1) {
        const curveArr = data.curve as { time_hours: number; concentration: number }[];
        // Find trough from curve (last local minimum)
        let curveTrough = curveArr[curveArr.length - 1].concentration;
        for (let i = 2; i < curveArr.length - 1; i++) {
          if (curveArr[i].concentration <= curveArr[i - 1].concentration && curveArr[i].concentration <= curveArr[i + 1].concentration) {
            curveTrough = curveArr[i].concentration;
          }
        }
        // AUC by trapezoidal rule over last 24h
        const tEnd = curveArr[curveArr.length - 1].time_hours;
        const t24Start = Math.max(0, tEnd - 24);
        const aucPts = curveArr.filter(p => p.time_hours >= t24Start);
        let trapAuc = 0;
        for (let i = 1; i < aucPts.length; i++) {
          trapAuc += 0.5 * (aucPts[i - 1].concentration + aucPts[i].concentration) * (aucPts[i].time_hours - aucPts[i - 1].time_hours);
        }
        const panelTrough = data.trough ?? 0;
        const panelAuc = data.auc24 ?? 0;
        const troughMatch = Math.abs(panelTrough - curveTrough) < 0.5;
        const aucDelta = Math.abs(panelAuc - trapAuc);
        const aucMatch = aucDelta < 5;
        console.log(
          `\nVANCOMYZER PK VALIDATION\n========================\n` +
          `Trough (panel):     ${fmt(Number(panelTrough), 2)} mg/L\n` +
          `Trough (graph):     ${fmt(curveTrough, 2)} mg/L\n` +
          `Match: ${troughMatch ? "✓ PASS" : "✗ FAIL (Δ=" + fmt(Math.abs(panelTrough - curveTrough), 2) + ")"}\n\n` +
          `AUC24 (panel):      ${fmt(Number(panelAuc), 1)} mg·h/L\n` +
          `AUC24 (trapezoid):  ${fmt(trapAuc, 1)} mg·h/L\n` +
          `Δ: ${fmt(aucDelta, 1)} mg·h/L${aucMatch ? " — within tolerance" : " — EXCEEDS tolerance"}\n` +
          `Match: ${aucMatch ? "✓ PASS" : "✗ FAIL"}\n\n` +
          `Model: ${modelDisplayName(data.pk_parameters?.pk_model_name)}\n` +
          `τ: ${data.recommended_interval_hours ?? "?"}h\n` +
          `Infusion: ${data.recommended_infusion_duration_hours ?? "?"}h`
        );
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [buildRequest, playSound]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!loading && rrt !== null && rrt !== true && !hideCalculate) {
          void handleCalculate();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, rrt, handleCalculate]);

  useEffect(() => {
    if (!bedboundDoseData || !(bedboundDoseData.dose_mg > 0) || !(bedboundDoseData.infusion_duration_hours > 0)) return;
    if (viewMode !== "one_level") applyViewMode("one_level");
    setRegimen((prev) => ({
      ...prev,
      dose_mg: bedboundDoseData.dose_mg,
      infusion_duration_hours: bedboundDoseData.infusion_duration_hours,
      doses_given: 1,
      interval_hours: prev.interval_hours > 0 ? prev.interval_hours : 12,
      target_auc24: prev.target_auc24 ?? 450,
    }));
    // Phase 1 → open Drug Levels section so the pharmacist can enter the level when drawn
    setActiveSection("levels");
  }, [bedboundDoseData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLastInputChangedAt(Date.now());
    // Clear field-level validation errors when the user modifies inputs so stale
    // "Must be a positive concentration" messages don't persist while the form is
    // still being filled. Errors reappear on the next failed Calculate attempt.
    setError((prev) => (prev?.field_errors ? { ...prev, field_errors: undefined } : prev));
  }, [patient, regimen, levels, mode]);

  useEffect(() => {
    const hasPatientCore = patient.age > 0 && patient.weight_kg > 0 && patient.serum_creatinine_mg_dl > 0;
    if (!hasPatientCore || mode !== "initial_regimen" || rrt === null || rrt === true) return;
    // Rate-limited: stay quiet until the window passes. The visitor can still
    // press Calculate, and the next field change after the window re-arms this.
    if (Date.now() < rateLimitedUntilRef.current) return;
    const timer = window.setTimeout(() => {
      void handleCalculate({ intent: "auto" });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [patient, mode, rrt, handleCalculate]);

  const handleReset = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setPatient({ ...defaultPatient });
    setRegimen({ ...defaultRegimen });
    setLevels([{ ...defaultLevel }]);
    setError(null);
    setResult(null);
    setViewMode("empiric");
    setMode("initial_regimen");
    setLastCalculatedAt(null);
    setSelectedFrequencyOption(null);
    setViewCurrentRegimen(false);
    setRrt(null);
    setActiveSection("patient");
    setBedbound(false);
    setBedboundDoseData(null);
  }, []);

  const fieldErrors = getModeScopedFieldErrors(mode, error?.field_errors);
  const handleSwitchToInitialRegimen = useCallback(() => applyViewMode("empiric"), [applyViewMode]);

  const hasStaleResult = Boolean(result && lastCalculatedAt && lastInputChangedAt && lastInputChangedAt > lastCalculatedAt);
  const visibleResult = hasStaleResult ? null : result;

  // Single source of truth: the currently active frequency option.
  // selectedFrequencyOption → user clicked a tab; recommendedOption → backend primary recommendation.
  // Every output section must read from activeOption rather than visibleResult directly.
  // The engine's recommended candidate is the default selection on both paths
  // (on the initial-regimen path its curve is the response's own curve at a
  // finer time step, so the graph is unchanged).
  const recommendedOption = visibleResult?.frequency_options?.find((o) => o.is_recommended) ?? null;
  // Existing-regimen path: "current regimen" view is a synthetic option built
  // from the response's top-level exposure and curve, which describe the
  // regimen as entered. On the pulse-dose path the top-level exposure is the
  // loading dose alone over its first 24 h, so the row plots the engine's
  // single-dose curve to match (the top-level curve is the dose continued at a
  // placeholder interval the loading-dose form never asks for). Each
  // candidate's curve is loading → that maintenance. Nothing is recomputed.
  const currentRegimenOption: FrequencyOption | null =
    viewCurrentRegimen && visibleResult?.recommendation_type === "existing_regimen"
      ? {
          dose_mg: regimen.dose_mg,
          interval_hours: regimen.interval_hours,
          infusion_duration_hours: regimen.infusion_duration_hours,
          auc24: visibleResult.auc24,
          peak: visibleResult.peak,
          trough: visibleResult.trough,
          is_recommended: false,
          curve: (regimen.doses_given === 1 ? visibleResult.loading_dose_curve : undefined) ?? visibleResult.curve,
          interpretation_summary: visibleResult.interpretation_summary,
          clinical_note: visibleResult.documentation_preview?.clinical_note,
        }
      : null;
  const activeOption = currentRegimenOption ?? (selectedFrequencyOption ?? recommendedOption);
  const activeIsCurrent = currentRegimenOption != null;
  // Estimated CrCl is reported by the engine as context text in key_inputs; it
  // is parsed for display on the renal row and never used in any calculation.
  const estimatedCrCl = (() => {
    const line = visibleResult?.calculation_details?.key_inputs?.find((k) => /Estimated CrCl/i.test(k));
    const m = line?.match(/Estimated CrCl\s+([\d.]+)\s*mL\/min\s*\(([^)]*)\)/i);
    return m ? { value: Number(m[1]), note: m[2].replace(/;.*$/, "") } : null;
  })();

  const patientReady = hasPatientCoreData(patient) && rrt !== null;
  const isPulseDose = regimen.doses_given === 1;
  const regimenReady = regimen.dose_mg > 0 && regimen.infusion_duration_hours > 0 &&
    (isPulseDose || regimen.interval_hours > 0);
  const levelReady = levels.some((level) => level.value_mcg_ml > 0 && level.time_since_last_dose_hours >= 0);

  // Bedbound two-phase gating:
  // Phase 1 — loading dose entered, level not yet drawn → Calculate hidden
  // Phase 2 — level concentration + collection_time both present → Calculate visible
  const bedboundLevelComplete = !bedbound || (
    (levels[0]?.value_mcg_ml ?? 0) > 0 &&
    Boolean(levels[0]?.collection_time)
  );
  const hideCalculate = bedbound && !bedboundLevelComplete;

  // Layout continuity: while inputs are stale or the model is running, keep
  // the last result mounted (obscured and non-interactive) instead of
  // unmounting it, so the workspace never jumps during recalculation.
  const displayResult = visibleResult ?? ((loading || hasStaleResult) ? result : null);
  const resultObscured = displayResult != null && visibleResult == null;
  const autoRecalcArmed = mode === "initial_regimen" && patientReady && rrt === false;

  const handleApplyRecommendedRegimen = useCallback(() => {
    if (!result?.recommended_dose || !result?.recommended_interval_hours) return;
    const dose = Number.parseFloat(result.recommended_dose);
    if (!Number.isFinite(dose) || dose <= 0) return;
    setRegimen((current) => ({
      ...current,
      dose_mg: dose,
      interval_hours: result.recommended_interval_hours ?? current.interval_hours,
      infusion_duration_hours:
        result.recommended_infusion_duration_hours ??
        (current.infusion_duration_hours > 0 ? current.infusion_duration_hours : dose >= 1250 ? 1.5 : 1),
    }));
  }, [result]);

  const handleSelectFrequency = useCallback((option: FrequencyOption | null) => {
    // Only update the visual display — do NOT touch regimen state, which would
    // trigger stale-result detection and wipe the graph. null = current regimen.
    setViewCurrentRegimen(option == null);
    setSelectedFrequencyOption(option);
  }, []);

  const pendingLoadingDoseCalc = useRef(false);

  const handleSimulateLoadingDose = useCallback((doseMg: number, intervalHours: number, infusionHours: number) => {
    // Snapshot current state so we can undo back to initial regimen results
    preLoadingDoseState.current = {
      viewMode,
      mode,
      regimen: { ...regimen },
      levels: levels.map(l => ({ ...l })),
      result,
      selectedFrequencyOption,
    };
    // Switch to existing_regimen mode with doses_given=1 (pulse/loading dose)
    // This tells the engine to show a single-dose PK curve, not steady state
    setViewMode("one_level");
    setMode("existing_regimen");
    setRegimen({
      dose_mg: doseMg,
      interval_hours: intervalHours,
      infusion_duration_hours: infusionHours,
      doses_given: 1,
      target_auc24: 450,
    });
    // Loading dose simulation: no measured levels yet (prior-only prediction)
    setLevels([{ ...defaultLevel }]);
    setSelectedFrequencyOption(null);
    setResult(null);
    setError(null);
    // Don't jump to levels tab — keep user in context, results appear in the right panel
    // The left panel stays where it is so the user isn't disoriented
    pendingLoadingDoseCalc.current = true;
  }, [viewMode, mode, regimen, levels, result, selectedFrequencyOption]);

  const handleUndoLoadingDose = useCallback(() => {
    const snap = preLoadingDoseState.current;
    if (!snap) return;
    setViewMode(snap.viewMode);
    setMode(snap.mode);
    setRegimen(snap.regimen);
    setLevels(snap.levels);
    setResult(snap.result);
    setSelectedFrequencyOption(snap.selectedFrequencyOption);
    setError(null);
    preLoadingDoseState.current = null;
  }, []);

  // Auto-trigger calculation after loading dose state is set
  useEffect(() => {
    if (pendingLoadingDoseCalc.current && mode === "existing_regimen" && regimen.doses_given === 1) {
      pendingLoadingDoseCalc.current = false;
      void handleCalculate();
    }
  }, [mode, regimen, handleCalculate]);

  const handleCopyNote = useCallback(() => {
    const note = activeOption?.clinical_note ?? visibleResult?.documentation_preview?.clinical_note;
    if (!note) return;
    navigator.clipboard.writeText(note).catch(() => {/* clipboard not available */});
  }, [activeOption, visibleResult]);

  const handleExportPDF = useCallback(() => {
    if (!visibleResult) return;
    const opt = activeOption;
    const reportData: ReportData = {
      age: patient.age,
      weight_kg: patient.weight_kg,
      serum_creatinine_mg_dl: patient.serum_creatinine_mg_dl,
      mode: visibleResult.recommendation_type,
      recommended_dose: opt ? String(opt.dose_mg) : visibleResult.recommended_dose,
      recommended_interval_hours: opt?.interval_hours ?? visibleResult.recommended_interval_hours,
      recommended_infusion_duration_hours: opt?.infusion_duration_hours ?? visibleResult.recommended_infusion_duration_hours,
      auc24: opt?.auc24 ?? visibleResult.auc24,
      peak: opt?.peak ?? visibleResult.peak,
      trough: opt?.trough ?? visibleResult.trough,
      pk_parameters: visibleResult.pk_parameters ? {
        CL: visibleResult.pk_parameters.CL,
        V1: visibleResult.pk_parameters.V1,
        Q: visibleResult.pk_parameters.Q,
        V2: visibleResult.pk_parameters.V2,
        used_posterior_refinement: visibleResult.pk_parameters.used_posterior_refinement,
      } : undefined,
      pk_model_name: visibleResult.pk_parameters?.pk_model_name,
      interpretation_summary: opt?.interpretation_summary ?? visibleResult.interpretation_summary,
      assumptions: visibleResult.assumptions,
      limitations: visibleResult.limitations,
      clinical_note: opt?.clinical_note ?? visibleResult.documentation_preview?.clinical_note,
      frequency_options: visibleResult.frequency_options?.filter(o => o.auc24 >= 400 && o.auc24 <= 600).map(o => ({
        dose_mg: o.dose_mg,
        interval_hours: o.interval_hours,
        auc24: o.auc24,
        peak: o.peak,
        trough: o.trough,
      })),
    };
    printReport(reportData, user?.subscriptionTier ?? "free");
  }, [visibleResult, activeOption, patient, user?.subscriptionTier]);

  const leftColumn = (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <InputSection
          id="patient"
          title="Patient"
          completed={patientReady}
          focusSection={activeSection}
        >
          <PatientCharacteristicsForm
            value={patient}
            onChange={setPatient}
            fieldErrors={fieldErrors}
            rrt={rrt}
            onRrtChange={(val) => {
              setRrt(val);
              if (val === true) {
                // Immediately retract any existing recommendation
                setResult(null);
                setError(null);
                setSelectedFrequencyOption(null);
                setLastCalculatedAt(null);
              }
            }}
            bedbound={bedbound}
            onBedboundChange={(val) => {
              setBedbound(val);
              if (!val) setBedboundDoseData(null);
            }}
            onBedboundLoadingDoseChange={setBedboundDoseData}
            estimatedCrCl={estimatedCrCl}
          />
        </InputSection>

        {/* Regimen — only in existing_regimen mode */}
        {mode === "existing_regimen" && (
          <InputSection id="regimen" title="Dosing history" completed={regimenReady} focusSection={activeSection}>
            <RegimenForm value={regimen} onChange={setRegimen} fieldErrors={fieldErrors} />
          </InputSection>
        )}

        {/* Levels — only in existing_regimen mode */}
        {mode === "existing_regimen" && (
          <InputSection id="levels" title="Drug levels" completed={levelReady} focusSection={activeSection}>
            {bedbound && (
              <div className="mb-2">
                {!bedboundLevelComplete ? (
                  <Advisory severity="caution" title="Phase 1 complete — awaiting level" role="status">
                    Loading dose recorded. Draw the vancomycin level per the timing in the Bedbound panel, then enter the concentration,
                    date and time below. <strong>Calculate</strong> unlocks once the level is entered.
                  </Advisory>
                ) : (
                  <Advisory severity="success" title="Phase 2 — level entered, ready to calculate" role="status">
                    Press <strong>Calculate</strong> to calculate the Bayesian estimate and receive a maintenance regimen recommendation.
                  </Advisory>
                )}
              </div>
            )}
            <LevelEntryTable
              levels={levels}
              onChange={setLevels}
              fieldErrors={fieldErrors}
              intervalHours={regimen.interval_hours || undefined}
              prefillDoseDate={bedboundDoseData?.adminDate}
              prefillDoseTime={bedboundDoseData?.adminTime}
            />
          </InputSection>
        )}

        {/* Long-form disclaimer stays on the page (scrolls with the rail); the
            regulatory strip at the bottom of every screen carries the short form. */}
        <div className="px-3 py-2">
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-dim)", fontFamily: "inherit", margin: 0 }}>
            Vancomyzer&trade; is designed to meet the criteria for non-device clinical decision support in section 520(o)(1)(E) of the Federal Food, Drug, and Cosmetic Act (added by section 3060 of the 21st Century Cures Act). It has not been cleared, approved or otherwise reviewed by the FDA. It is intended for licensed healthcare professionals, who must independently review the basis for each recommendation. Vancomyzer has not yet been validated in real patients. Its equations are checked against published values and synthetic test cases; external validation with patient data is planned. It is not a substitute for clinical judgment, institutional protocols, or therapeutic drug monitoring.{" "}
            {/* A real button so the full disclaimer is reachable by keyboard and screen readers. */}
            <button
              type="button"
              onClick={() => setDisclaimerOpen(true)}
              className="underline"
              style={{ color: "var(--color-primary)", cursor: "pointer", background: "transparent", border: "none", padding: 0, font: "inherit" }}
            >
              [See Full Disclaimer]
            </button>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {[
              { href: "/disclaimer", label: "Disclaimer" },
              { href: "/terms", label: "Terms" },
              { href: "/privacy", label: "Privacy" },
              { href: "/about", label: "About" },
              { href: "/contact", label: "Contact" },
            ].map(({ href, label }) => (
              <a key={href} href={href} className="text-[10px] underline-offset-2 hover:underline" style={{ color: "var(--color-dim)" }}>
                {label}
              </a>
            ))}
            <span className="text-[10px]" style={{ color: "var(--color-dim)" }}>
              {"©"} 2026 Vancomyzer{"™"} {"·"} Engineered by{" "}
              <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                D{"ō"}sys{"™"}
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Actions — sticky at the bottom of the rail; nothing else competes for that space. */}
      <div className="sticky bottom-0 mt-auto border-t px-3 py-2" style={{ borderTopColor: "var(--color-border)", background: "var(--color-card)", boxShadow: "0 -4px 12px rgba(0,0,0,0.06)" }}>
        <CalculatorActionBar
          onCalculate={handleCalculate}
          onReset={handleReset}
          disabled={loading || rrt === null || rrt === true}
          loading={loading}
          hideCalculate={hideCalculate}
          showCaseId={canSaveHistory}
          caseId={caseId}
          onCaseIdChange={setCaseId}
        />
      </div>
    </div>
  );

  // ── Derived display values shared by the band, the table and the graph ──
  const isPulse = regimen.doses_given === 1;
  // One rule for every path: the active option's exposure, else the response's
  // top-level exposure (the regimen as entered).
  const metricAuc = activeOption?.auc24 ?? displayResult?.auc24;
  const metricPeak = activeOption?.peak ?? displayResult?.peak;
  const metricTrough = activeOption?.trough ?? displayResult?.trough;
  const metricsCaption = isPulse
    ? activeIsCurrent
      ? `Loading dose — ${regimen.dose_mg} mg × 1 · first 24 h, not steady state`
      : `Maintenance after loading dose${activeOption ? ` — ${activeOption.dose_mg} mg q${activeOption.interval_hours}h` : ""} — steady-state PK`
    : activeIsCurrent
      ? (displayResult?.exposure_horizon === "actual_history"
          ? `Current regimen — steady-state projection (actual history: ${displayResult.actual_history_exposure?.doses_given ?? "?"} doses given)`
          : "Current regimen (as entered) — steady-state exposure")
      : "Predicted steady-state exposure";
  const currentRegimenRow =
    displayResult?.recommendation_type === "existing_regimen" && regimen.dose_mg > 0 && (isPulse || regimen.interval_hours > 0)
      ? {
          dose_mg: regimen.dose_mg,
          interval_hours: regimen.interval_hours,
          auc24: displayResult.auc24,
          peak: displayResult.peak,
          trough: displayResult.trough,
          label: isPulse ? "loading dose" : "current",
          single_dose: isPulse,
        }
      : null;
  // The engine's recommendation may fall outside the candidate list's display
  // rule (dose ≥ 500 mg, AUC₂₄ ≤ 600). It is still shown as the recommendation
  // — never swapped for an alternative — and flagged so the reviewer sees why.
  const recommendedOutsideDisplayRule =
    recommendedOption != null && !(recommendedOption.dose_mg >= 500 && recommendedOption.auc24 <= 600);
  // Dashed reference on the graph: the engine recommendation whenever something
  // else is selected (an alternative, the current regimen or the first dose).
  const comparisonCurve =
    recommendedOption?.curve && activeOption !== recommendedOption && !(activeOption?.is_recommended)
      ? recommendedOption.curve
      : null;
  const comparisonLabel = recommendedOption
    ? `Recommended ${recommendedOption.dose_mg} mg q${recommendedOption.interval_hours}h${isPulse ? " after loading dose" : " (steady state)"}`
    : null;
  const clinicalNote = activeOption?.clinical_note ?? displayResult?.documentation_preview?.clinical_note ?? "";
  const exportsDisabled = resultObscured || !visibleResult;

  const advisories: ReactNode[] = [];
  if (displayResult?.review_hold) {
    advisories.push(
      <Advisory key="review-hold" severity="warning" title="Review required — no dose adjustment presented." summary={displayResult.review_hold.message} role="alert" />,
    );
  }
  if (displayResult?.actual_history_exposure && displayResult.exposure_horizon === "actual_history") {
    const a = displayResult.actual_history_exposure;
    const ap = displayResult.steady_state_approach;
    advisories.push(
      <Advisory
        key="actual-history"
        severity="info"
        title={`Actual history — dose ${a.doses_given}:`}
        summary={`modelled peak ${fmt(a.peak, 1)} / trough ${fmt(a.trough, 1)} mcg/mL; AUC over that interval ${a.auc_interval_n.toFixed(0)} mg·h/L (not a daily AUC)${ap ? `; ${(ap.fraction_of_steady_state * 100).toFixed(0)}% of steady state (t½ ${fmt(ap.terminal_half_life_hours, 1)} h)` : ""}. These history values describe the entered dosing history. The AUC₂₄/peak/trough above describe the selected regimen at steady state.`}
        role="status"
      />,
    );
  }
  if (displayResult?.timing_warnings && displayResult.timing_warnings.length > 0) {
    advisories.push(
      <Advisory key="timing" severity="caution" title="Lab timing advisory" role="status">
        <ul className="list-disc pl-4">{displayResult.timing_warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      </Advisory>,
    );
  }
  const fitWarnings = (displayResult?.fit_quality_warnings ?? []).filter((w) => w !== displayResult?.steady_state_warning);
  if (fitWarnings.length > 0) {
    advisories.push(
      <Advisory key="fit" severity="caution" title="Fit quality advisory" role="status">
        <ul className="list-disc pl-4">{fitWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      </Advisory>,
    );
  }
  if (displayResult?.steady_state_warning) {
    advisories.push(
      <Advisory key="ss-approach" severity="caution" title="Steady-state check" summary={displayResult.steady_state_warning} role="status" />,
    );
  }
  if (recommendedOutsideDisplayRule && recommendedOption && !displayResult?.empiric_dosing_blocked && !displayResult?.adjustment_dosing_blocked) {
    advisories.push(
      <Advisory
        key="display-floor"
        severity="caution"
        title="Recommendation outside the candidate display rule."
        summary={`The calculator's recommendation (${recommendedOption.dose_mg} mg q${recommendedOption.interval_hours}h, AUC₂₄ ${recommendedOption.auc24}) is ${recommendedOption.dose_mg < 500 ? "below the 500 mg practical dose floor" : "above the 600 mg·h/L AUC₂₄ ceiling"} applied to the candidate list. It is shown as returned; verify against institutional protocol before use.`}
        role="status"
      />,
    );
  }
  if (displayResult?.calculation_details && (metricAuc ?? 0) > 600) {
    advisories.push(
      <Advisory key="auc-high" severity="warning" title="Predicted AUC₂₄ > 600" summary="Potential for elevated nephrotoxicity risk. Proceed with extreme caution." role="alert" />,
    );
  }
  const priorOnlyEmpiric = viewMode === "empiric" && displayResult?.calculation_details?.review_status.level === "prior_only";
  if (displayResult?.calculation_details && !priorOnlyEmpiric) {
    const rs = displayResult.calculation_details.review_status;
    const sev = rs.level === "supported" ? "success" : rs.level === "caution" ? "caution" : "info";
    advisories.push(
      <Advisory key="review" severity={sev} title={rs.banner_title} summary={rs.banner_body} collapsible>
        <p className="m-0"><strong>Evidence:</strong> {displayResult.calculation_details.evidence_strength}. {displayResult.calculation_details.data_quality_summary}</p>
        {rs.next_actions.length > 0 && (
          <ul className="mt-1 list-disc pl-4">{rs.next_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        )}
      </Advisory>,
    );
  }
  if (viewMode === "empiric" && displayResult && !displayResult.empiric_dosing_blocked) {
    advisories.push(
      <Advisory
        key="sampling"
        severity="info"
        title={displayResult.calculation_details?.review_status.banner_title ?? "Prior-only maintenance suggestion"}
        summary="Population prior only — no measured level used. Draw a level and re-run for an individualized Bayesian fit."
        collapsible
        action={
          <button
            type="button"
            onClick={() => applyViewMode("one_level")}
            className="rounded border px-2 py-0.5 text-[11px] font-semibold"
            style={{ borderColor: "#2b6cb0", background: "#fff", color: "#1e3a5f", cursor: "pointer" }}
          >
            1-Level workflow →
          </button>
        }
      >
        {displayResult.calculation_details?.review_status.banner_body && (
          <p className="m-0 mb-1">{displayResult.calculation_details.review_status.banner_body}</p>
        )}
        <ul className="list-disc pl-4">
          <li><strong>Earliest meaningful:</strong> 1.5–6 h after dose 1 post-infusion end (sparse single-level workflow).</li>
          <li><strong>Highest AUC accuracy:</strong> peak + trough near dose 3–4 at steady state (ASHP/IDSA 2020).</li>
          <li>Target AUC₂₄ 400–600 mg·h/L within 48 h per ASHP/IDSA 2020.</li>
        </ul>
      </Advisory>,
    );
  }
  if (patient.age > 65 && !rrt) {
    advisories.push(
      <Advisory key="age" severity="caution" title="Age > 65 — enhanced monitoring" summary="Renal function may decline faster than SCr reflects." collapsible>
        <p className="m-0">
          The {COLIN_2019.shortName} model includes an age-decline function (FDecline), but renal function in older adults may decline faster than SCr reflects — especially with low muscle mass. Consider:
        </p>
        <ul className="mt-1 list-disc pl-4">
          <li>More frequent vancomycin level monitoring (every 24–48 h rather than 72 h)</li>
          <li>Daily SCr to detect early renal deterioration</li>
          <li>If SCr appears low relative to clinical status, rely on early measured levels rather than rounding SCr up (routine rounding to 1 mg/dL reduced dose-prediction accuracy in older adults; Bukhari 2024)</li>
          <li>Measured levels with Bayesian refinement, rather than population estimates alone, to individualize dosing in patients &gt;65</li>
        </ul>
      </Advisory>,
    );
  }

  const graphCurve =
    activeOption?.curve
    ?? (showEngineRecommended && displayResult?.curve_engine_recommended
        ? displayResult.curve_engine_recommended
        : displayResult?.curve ?? []);

  const detailTabs = displayResult ? [
    {
      id: "pk",
      label: "Drug handling",
      content: (
        <div className="flex flex-col gap-2">
          {displayResult.pk_parameters ? (
            <PKParametersMath params={displayResult.pk_parameters} />
          ) : (
            <p className="text-xs" style={{ color: "var(--color-dim)" }}>No pharmacokinetic estimates are available.</p>
          )}
          {displayResult.calculation_details?.key_inputs && displayResult.calculation_details.key_inputs.length > 0 && (
            <div>
              <p className="vz-kicker m-0 mb-1">Key inputs</p>
              <ul className="list-disc pl-4 text-[11.5px] leading-5" style={{ color: "var(--color-secondary)" }}>
                {displayResult.calculation_details.key_inputs.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          <TeachingNote label="What are CL, V₁, Q, V₂?">
            <p style={{ marginTop: 0 }}>
              Vancomycin distributes through two compartments: a central one (the bloodstream + well-perfused
              organs) and a peripheral one (less-perfused tissues). The four PK parameters describe this:
            </p>
            <ul style={{ marginTop: 6, paddingLeft: 18, listStyle: "disc" }}>
              <li><strong>CL</strong> — clearance (L/h). How fast the body eliminates the drug. Falls with renal impairment and with age ({COLIN_2019.shortName} FDecline).</li>
              <li><strong>V₁</strong> — central volume (L). Initial dilution space at the end of infusion; drives peak concentration.</li>
              <li><strong>Q</strong> — intercompartmental clearance (L/h). Speed of redistribution between central and peripheral.</li>
              <li><strong>V₂</strong> — peripheral volume (L). Where the drug temporarily &ldquo;hides&rdquo;; it slowly returns to central as the central level falls.</li>
            </ul>
            <p style={{ marginTop: 6 }}>
              When you enter a measured level, the Bayesian MAP fit shifts these parameters from the population
              prior toward your patient&rsquo;s individual values — bounded so a single observation can&rsquo;t over-fit.
            </p>
          </TeachingNote>
        </div>
      ),
    },
    {
      id: "method",
      label: "Method",
      content: (
        <div className="flex flex-col gap-2">
          <CalculationMethodPanel
            mode={mode}
            levelCount={levels.length}
            details={displayResult.calculation_details}
            assumptions={displayResult.assumptions}
            infusionDurationAdjustedForSafety={displayResult.infusion_duration_adjusted_for_safety}
            pkModelName={displayResult.pk_parameters?.pk_model_name}
          />
          <TeachingNote label="What is AUC₂₄, and why 400–600?">
            <p style={{ marginTop: 0 }}>
              <strong>AUC₂₄</strong> is the area under the concentration-time curve over 24 hours
              (mg·h/L). For vancomycin, it&rsquo;s the exposure metric that best correlates with
              both efficacy against MRSA and the risk of acute kidney injury.
            </p>
            <p style={{ marginTop: 6 }}>
              The 2020 ASHP/IDSA/PIDS/SIDP consensus guideline recommends a target of
              <strong> 400–600 mg·h/L</strong>. Below 400 → underdosed (risk of treatment failure
              and resistance selection). Above 600 → significant nephrotoxicity risk, especially
              if sustained beyond 48 hours. The trough number alone is no longer the recommended
              target — AUC integrates the entire dosing interval and is more clinically meaningful.
            </p>
          </TeachingNote>
          {displayResult.pk_parameters?.used_posterior_refinement && (
            <TeachingNote label="How does Bayesian feedback work?">
              <p style={{ marginTop: 0 }}>
                The calculator starts with a population prior — what we&rsquo;d expect for an &ldquo;average&rdquo;
                patient with this age, weight, and SCr, from the {COLIN_2019.shortName} model. Model source:{" "}
                {COLIN_2019.sourcePopulation}
                {" "}When you enter a measured level, MAP-Bayesian estimation shifts the patient&rsquo;s individual
                PK parameters toward values that better explain the measurement, while a log-normal
                prior penalty keeps the shift bounded — a single observation cannot move the estimates far
                from what the population model considers plausible.
              </p>
              <p style={{ marginTop: 6 }}>
                With one level the fit is bounded by the prior; with two or more well-timed levels
                (peak + trough) the fit becomes much more individualized and the recommendation
                can deviate further from population averages. If the residual stays large, you&rsquo;ll
                see a Fit Quality Advisory — that&rsquo;s a signal to draw a confirmatory level
                rather than over-trust the recommendation.
              </p>
            </TeachingNote>
          )}
        </div>
      ),
    },
    {
      id: "interpretation",
      label: "Interpretation",
      content: (
        <div>
          <FeatureGate
            feature="interpretation.why_this_result"
            fallback={
              <div className="rounded-md border px-3 py-2" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
                <p className="text-xs font-semibold" style={{ color: "#1e40af" }}>Why this result — Individual Pro</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "#1e3a8a" }}>
                  The plain-language clinical reasoning behind each recommendation (drivers, evidence, caveats) is part of the
                  documentation suite on Individual Pro and above — alongside Copy Note and Export PDF.
                </p>
                <Link href="/pricing" className="mt-1.5 inline-block text-xs font-semibold underline" style={{ color: "#1e40af" }}>
                  See pricing →
                </Link>
              </div>
            }
          >
            <InterpretationSummaryCard interpretation_summary={activeOption?.interpretation_summary ?? displayResult.interpretation_summary} />
          </FeatureGate>
          <LimitationsCard limitations={displayResult.limitations} calculationDetails={displayResult.calculation_details} />
        </div>
      ),
    },
    ...(clinicalNote ? [{
      id: "note",
      label: "Note",
      content: (
        <div>
          <p className="vz-kicker m-0 mb-1">Clinical note preview</p>
          <pre className="m-0 whitespace-pre-wrap text-[11.5px] leading-5" style={{ fontFamily: "inherit", color: "var(--color-secondary)" }}>{clinicalNote}</pre>
        </div>
      ),
    }] : []),
  ] : [];

  const rightColumn = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:p-2.5">
      {/* Draft/stale banner replaced by the obscured-result overlay below; error keeps the layout. */}
      {!loading && error && (
        <div className="shrink-0">
          <CalculatorErrorState message={error.message} details={error.details} limitations={error.limitations} recoveryGuidance={error.recovery_guidance} fallbackWorkflow={error.fallback_workflow} onSwitchToInitialRegimen={handleSwitchToInitialRegimen} />
        </div>
      )}

      <div className="vz-results">
        {/* ── Primary recommendation band ── */}
        <section className="vz-area-band vz-panel" aria-labelledby="vz-band-title" aria-busy={loading}>
          <div className="vz-panel-head">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id="vz-band-title" className="vz-panel-title m-0">
                {displayResult?.recommendation_type === "existing_regimen" ? "Dosing adjustment" : "Dosing recommendation"}
              </h2>
              {displayResult && (
                <span className="hidden md:inline">
                  <span className="vz-chip vz-chip--neutral" title="Population PK model">
                    {modelShortName(displayResult.pk_parameters?.pk_model_name)} · 2-compartment
                  </span>
                </span>
              )}
              {displayResult?.pk_parameters && (
                <span className="hidden sm:inline">
                  <span className={`vz-chip ${displayResult.pk_parameters.used_posterior_refinement ? "vz-chip--ok" : "vz-chip--neutral"}`}>
                    {displayResult.pk_parameters.used_posterior_refinement ? "Bayesian fit" : "Prior only"}
                  </span>
                </span>
              )}
              {loading && (
                <span className="vz-chip vz-chip--neutral" role="status">Running PK model<span className="mx-blink">_</span></span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {displayResult && (
                <div className={exportsDisabled ? "pointer-events-none opacity-40" : ""} aria-disabled={exportsDisabled}>
                  <div className="flex items-center gap-1.5">
                    {!isPulse && !displayResult.empiric_dosing_blocked && !displayResult.adjustment_dosing_blocked && (
                      <LoadingDosePopover weightKg={patient.weight_kg > 0 ? patient.weight_kg : null} onSimulate={handleSimulateLoadingDose} />
                    )}
                    <PdfExportGate tier={user?.subscriptionTier ?? "free"} onExport={handleExportPDF} />
                    {clinicalNote && (
                      <NoteExportGate tier={user?.subscriptionTier ?? "free"} onCopy={handleCopyNote} noteText={clinicalNote} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`p-2 ${resultObscured ? "vz-obscured" : ""}`}>
            <div className={resultObscured ? "vz-obscured-content" : ""} aria-hidden={resultObscured}>
              {displayResult ? (
                <div className="flex flex-col gap-2">
                  {/* Pulse-dose curve toggle */}
                  {displayResult.curve_engine_recommended && !activeOption && !displayResult.adjustment_dosing_blocked && (
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: "var(--color-secondary)" }}>Curve:</span>
                      <div className="vz-seg">
                        <button type="button" aria-pressed={!showEngineRecommended} onClick={() => setShowEngineRecommended(false)}>
                          {isPulse ? `Loading dose continued (${regimen.dose_mg} mg q${regimen.interval_hours}h)` : `Your regimen (${regimen.dose_mg} mg q${regimen.interval_hours}h)`}
                        </button>
                        <button type="button" aria-pressed={showEngineRecommended} onClick={() => setShowEngineRecommended(true)}>
                          Engine recommendation
                        </button>
                      </div>
                    </div>
                  )}
                  {displayResult.review_hold && (
                    <div className="flex flex-wrap items-stretch gap-2">
                      <div className="flex-1 min-w-[260px] px-3 py-2" style={{ background: "var(--color-bg)", border: "1px solid #fca5a5" }}>
                        <p className="vz-kicker m-0 mb-0.5">Recommendation withheld</p>
                        <p className="m-0 text-xs" style={{ color: "#7f1d1d" }}>Reconcile the discordant same-time levels, then recalculate.</p>
                      </div>
                      <div className="flex-[1.4] min-w-[300px]">
                        <PrimaryMetricsCard compact caption={metricsCaption} ungraded={isPulse && activeIsCurrent} auc24={metricAuc} peak={metricPeak} trough={metricTrough} />
                      </div>
                    </div>
                  )}
                  <DoseRecommendationCard
                    layout="band"
                    showOptionTabs={false}
                    showLoadingDose={false}
                    activeOption={activeOption}
                    activeIsCurrent={activeIsCurrent}
                    recommended_dose={displayResult.recommended_dose}
                    recommended_interval_hours={displayResult.recommended_interval_hours}
                    recommendation_type={displayResult.recommendation_type}
                    calculationDetails={displayResult.calculation_details}
                    recommended_infusion_duration_hours={displayResult.recommended_infusion_duration_hours}
                    infusion_duration_adjusted_for_safety={displayResult.infusion_duration_adjusted_for_safety}
                    infusion_safety_note={displayResult.infusion_safety_note}
                    frequency_options={displayResult.frequency_options}
                    draftDiffersFromCalculated={hasStaleResult}
                    onApplyRecommendation={handleApplyRecommendedRegimen}
                    onSelectFrequency={handleSelectFrequency}
                    onSimulateLoadingDose={handleSimulateLoadingDose}
                    patientWeightKg={patient.weight_kg > 0 ? patient.weight_kg : null}
                    auc_range_status={displayResult.auc_range_status}
                    arc_advisory={displayResult.arc_advisory}
                    auc24={displayResult.auc24}
                    predicted_auc24={displayResult.predicted_auc24}
                    isPulseDose={isPulse}
                    loadingDoseMg={isPulse ? regimen.dose_mg : null}
                    onUndoLoadingDose={preLoadingDoseState.current ? handleUndoLoadingDose : undefined}
                    empiricDosingBlocked={displayResult.empiric_dosing_blocked}
                    adjustmentDosingBlocked={displayResult.adjustment_dosing_blocked}
                    metricsSlot={
                      <div className="flex-[1.4] min-w-[300px]">
                        <PrimaryMetricsCard compact caption={metricsCaption} ungraded={isPulse && activeIsCurrent} auc24={metricAuc} peak={metricPeak} trough={metricTrough} />
                      </div>
                    }
                  />
                  <TeachingNote label="Why this dose?">
                    {displayResult.recommendation_type === "existing_regimen" ? (
                      <>
                        When the level data support an individualized fit, the calculator compares doses of 250–2000 mg at
                        q6h, q8h, q12h, q18h, q24h, q36h or q48h, discards candidates whose predicted peak, trough or AUC₂₄
                        exceed the safety limits, and picks the one whose predicted steady-state AUC₂₄ lands closest to the
                        midpoint of the 400–600 target. With sparse or weak level data (for example, a single level or a poor
                        fit) it instead scales the current dose toward that midpoint at the current interval, within the same
                        safety limits.
                      </>
                    ) : (
                      <>
                        The calculator compares doses of 500–2000 mg at q6h, q8h, q12h or q24h, discards candidates whose predicted
                        peak, trough or AUC₂₄ exceed the safety limits, and picks the one whose predicted steady-state AUC₂₄
                        lands closest to the midpoint of the 400–600 target.
                      </>
                    )}{" "}
                    Peak and trough are forward-predicted from the patient&rsquo;s posterior PK (or population prior if no
                    level is fit) using the two-compartment model. The recommendation always favors options that stay
                    within target rather than ones that hit midpoint exactly outside the window.
                  </TeachingNote>
                  {advisories.length > 0 && <div className="flex flex-col gap-1.5">{advisories}</div>}
                </div>
              ) : (
                /* ── Empty state: zeroed band mirroring the populated layout ── */
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-stretch gap-2" style={{ opacity: 0.45 }} aria-hidden="true">
                    <div className="flex-1 min-w-[260px] px-3 py-2" style={{ background: "var(--color-bg)", border: "1px solid var(--color-primary-a40)" }}>
                      <p className="vz-kicker m-0 mb-0.5">Recommended regimen</p>
                      <div className="flex items-baseline gap-x-1.5">
                        <span className="text-[34px] leading-none font-extrabold tabular-nums" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>&mdash;</span>
                        <span className="text-lg font-semibold" style={{ color: "var(--color-secondary)" }}>mg</span>
                        <span className="text-sm mx-1" style={{ color: "var(--color-dim)" }}>every</span>
                        <span className="text-[34px] leading-none font-extrabold tabular-nums" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>&mdash;</span>
                        <span className="text-lg font-semibold" style={{ color: "var(--color-secondary)" }}>h</span>
                      </div>
                    </div>
                    <div className="flex-[1.4] min-w-[300px]">
                      <PrimaryMetricsCard compact caption="Predicted steady-state exposure" auc24={null} peak={null} trough={null} />
                    </div>
                  </div>
                  {loading ? (
                    <Advisory severity="info" title="Running PK model" summary="Calculating exposure metrics and regimen guidance…" role="status" />
                  ) : !error ? (
                    <Advisory
                      severity="info"
                      title={rrt === true ? "Calculator blocked for RRT." : patientReady ? "Ready." : "Enter patient data to begin."}
                      summary={
                        rrt === true
                          ? "The model is not validated for renal replacement therapy."
                          : mode === "initial_regimen"
                            ? "Enter age, weight, serum creatinine and renal replacement therapy status. The population-model estimate starts automatically when the required inputs are valid."
                            : "Enter the current regimen and measured level(s), then press Calculate."
                      }
                      role="status"
                    />
                  ) : null}
                  <div className="vz-advisory vz-advisory--caution" role="note">
                    <div className="vz-advisory-row">
                      <span aria-hidden="true" className="inline-flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-black leading-none" style={{ border: "1px solid currentColor", borderRadius: 3, marginTop: 2 }}>!</span>
                      <span className="min-w-0">
                        <span className="font-bold">Scope:</span> Adults receiving intermittent IV vancomycin only. Not for children, dialysis or continuous infusion. {mode === "initial_regimen" ? "Starting maintenance estimates use patient characteristics without measured levels; review infection severity separately." : "Enter accurate dose and sample times from the same dosing interval and a consistent prior dosing schedule."}
                      </span>
                      <a href="/transparent-dosing" className="text-[11px] font-semibold underline" style={{ color: "inherit" }}>Evidence</a>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {resultObscured && (
              <div className="vz-obscured-overlay" role="status" aria-live="polite">
                <div className="rounded-md border px-4 py-2 text-center text-xs font-semibold shadow-md" style={{ background: "#fffbeb", borderColor: "#fcd34d", color: "#78350f" }}>
                  {loading ? "Running PK model…" : autoRecalcArmed ? "Inputs changed — recalculating…" : "Inputs changed — press Calculate to refresh these results."}
                </div>
              </div>
            )}
          </div>
          {displayResult && !resultObscured && (
            <div className="border-t px-2 py-1 text-[10.5px]" style={{ borderTopColor: "var(--color-border)", color: "var(--color-dim)" }}>
              Safety guardrails: adult intermittent IV workflow only · not for pediatrics, dialysis-specific or continuous infusion ·{" "}
              {displayResult.recommendation_type === "initial_regimen" ? "prior-only maintenance support; not patient-specific severity direction" : "requires interpretable same-interval timing and routine dose history"}.{" "}
              <a href="/transparent-dosing" className="underline">Evidence</a>
            </div>
          )}
        </section>

        {/* ── Concentration-time graph ── */}
        <section className={`vz-area-graph vz-panel flex flex-col ${resultObscured ? "vz-obscured" : ""}`} aria-label="Concentration-time graph panel">
          <div className={`flex min-h-0 flex-1 flex-col p-2 ${resultObscured ? "vz-obscured-content" : ""}`}>
            <ConcentrationTimeGraph
              fill={graphFill}
              curve={graphCurve}
              comparison_curve={comparisonCurve}
              comparison_label={comparisonLabel}
              measured_levels={displayResult?.measured_levels ?? []}
              calculationDetails={displayResult?.calculation_details ?? null}
              pk_model_name={displayResult?.pk_parameters?.pk_model_name}
              uncertainty_label={displayResult ? deriveBandUncertaintyLabel(displayResult) : undefined}
            />
          </div>
        </section>

        {/* ── Side rail: alternatives + secondary detail ── */}
        <aside className="vz-area-side flex flex-col gap-2" aria-label="Regimen comparison and calculation details">
          <section className={`vz-panel shrink-0 ${resultObscured ? "vz-obscured" : ""}`} aria-labelledby="vz-alt-title">
            <div className="vz-panel-head">
              <h2 id="vz-alt-title" className="vz-panel-title m-0">Candidate regimens</h2>
              {displayResult && (
                <span className="text-[10px]" style={{ color: "var(--color-dim)" }}>select a row to preview</span>
              )}
            </div>
            <div className={resultObscured ? "vz-obscured-content" : ""}>
              {displayResult && !displayResult.empiric_dosing_blocked && !displayResult.adjustment_dosing_blocked ? (
                <RegimenComparisonTable
                  options={displayResult.frequency_options}
                  activeOption={activeIsCurrent ? null : activeOption}
                  onSelect={handleSelectFrequency}
                  current={currentRegimenRow}
                  onApply={displayResult.recommendation_type === "existing_regimen" && !isPulse ? (option) => {
                    setRegimen((current) => ({
                      ...current,
                      dose_mg: option.dose_mg,
                      interval_hours: option.interval_hours,
                      infusion_duration_hours: option.infusion_duration_hours || (current.infusion_duration_hours > 0 ? current.infusion_duration_hours : 1),
                    }));
                  } : null}
                />
              ) : (
                <p className="px-3 py-3 text-xs" style={{ color: "var(--color-dim)" }}>
                  {displayResult ? "No candidate regimens — see the safety state above." : "Candidate regimens with predicted AUC₂₄, peak and trough appear here after calculation."}
                </p>
              )}
            </div>
          </section>

          <section className={`vz-panel flex min-h-0 flex-1 flex-col ${resultObscured ? "vz-obscured" : ""}`} aria-label="Calculation details">
            <div className={`flex min-h-0 flex-1 flex-col ${resultObscured ? "vz-obscured-content" : ""}`}>
              {displayResult ? (
                <ResultDetailTabs tabs={detailTabs} storageKey="vancomyzer_detail_tab" />
              ) : (
                <div className="p-3 text-sm" style={{ color: "var(--color-secondary)" }}>
                  <h3 className="mb-2 font-semibold">Calculation details</h3>
                  <p>Enter patient details to view calculations. Parameters and substituted equations appear after a valid result is available.</p>
                  <a href="/transparent-dosing/equations" className="mt-3 inline-block underline">Review model equations and references</a>
                </div>
              )}
            </div>
          </section>

          {/* Free-tier upgrade prompt — self-gates, dismissible per session */}
          <UpgradeBanner />
        </aside>
      </div>
    </div>
  );

  return (
    <div className="vz-app relative" style={{ background: "var(--color-bg)", color: "var(--color-primary)" }}>
      {/* LOGOUT only when someone is signed in; open-access visitors get a
          SIGN IN link in the same slot once the session check has settled. */}
      <CalculatorHeader viewMode={viewMode} onViewModeChange={applyViewMode} onSettingsOpen={() => setSettingsOpen(true)} userName={user?.username} userRole={user?.role} onLogout={user ? logout : undefined} showSignIn={!authLoading && !user} />
      {loadedCase && (
        <div
          role="status"
          className="shrink-0"
          style={{
            padding: "4px 12px",
            background: "#eff6ff",
            borderBottom: "1px solid #bfdbfe",
            color: "#1e3a8a",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            📚 Loaded from literature case: <strong>{loadedCase.reference}</strong>. Edit inputs freely — the case stays linked until you reset.
          </span>
          <a
            href={`/transparent-dosing/cases#${loadedCase.id}`}
            style={{ marginLeft: "auto", color: "#1e3a8a", textDecoration: "underline", fontWeight: 600 }}
          >
            View case page →
          </a>
          <button
            type="button"
            onClick={() => setLoadedCase(null)}
            aria-label="Dismiss case banner"
            style={{ background: "transparent", border: "none", color: "#1e3a8a", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
          >
            ×
          </button>
        </div>
      )}
      <CalculatorLayout left={leftColumn} right={rightColumn} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DisclaimerModal open={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} />
    </div>
  );
}
