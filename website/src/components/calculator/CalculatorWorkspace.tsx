"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type {
  CalculatorMode,
  CalculateRequest,
  CalculateResponse,
  CalculateErrorResponse,
  CalculateRequestRegimen,
  FrequencyOption,
} from "@/types/calculator";
import type { BedboundDoseData } from "@/components/calculator/BedboundAdvisoryPanel";
import CalculatorHeader from "@/components/calculator/CalculatorHeader";
import CalculatorLayout from "@/components/calculator/CalculatorLayout";
import PatientCharacteristicsForm from "@/components/calculator/PatientCharacteristicsForm";
import CalculationMethodPanel from "@/components/calculator/CalculationMethodPanel";
import RegimenForm from "@/components/calculator/RegimenForm";
import LevelEntryTable from "@/components/calculator/LevelEntryTable";
import CalculatorActionBar from "@/components/calculator/CalculatorActionBar";
import PrimaryMetricsCard from "@/components/calculator/PrimaryMetricsCard";
import DoseRecommendationCard from "@/components/calculator/DoseRecommendationCard";
import ClinicalSignalStrip from "@/components/calculator/ClinicalSignalStrip";
import InterpretationSummaryCard from "@/components/calculator/InterpretationSummaryCard";
import AssumptionsCard from "@/components/calculator/AssumptionsCard";
import LimitationsCard from "@/components/calculator/LimitationsCard";
import ConcentrationTimeGraph from "@/components/calculator/ConcentrationTimeGraph";
import ClinicalNotePreview from "@/components/calculator/ClinicalNotePreview";
import CalculatorLoadingState from "@/components/calculator/CalculatorLoadingState";
import CalculatorErrorState from "@/components/calculator/CalculatorErrorState";
import CalculatorResultState from "@/components/calculator/CalculatorResultState";
import ResultScopeBanner from "@/components/calculator/ResultScopeBanner";
import CalculationDetailsCard from "@/components/calculator/CalculationDetailsCard";
import DataFitReviewabilityPanel from "@/components/calculator/DataFitReviewabilityPanel";
import RegimenSuggestionCard from "@/components/calculator/RegimenSuggestionCard";
import SettingsPanel from "@/components/calculator/SettingsPanel";
import DisclaimerModal from "@/components/calculator/DisclaimerModal";
import PKParametersMath from "@/components/calculator/PKParametersMath";
import { useMatrixSettings } from "@/contexts/MatrixSettingsContext";

const defaultPatient = { age: 0, weight_kg: 0, serum_creatinine_mg_dl: 0 };
const defaultRegimen: CalculateRequestRegimen = { dose_mg: 0, interval_hours: 0, infusion_duration_hours: 0 };
const defaultLevel = { value_mcg_ml: 0, collection_time: "", time_since_last_dose_hours: 0 };

type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

const patientCompletionItems = [
  "Age, weight, and serum creatinine",
  "Adult patient only",
  "Inputs complete enough for a model-backed initial regimen calculation",
];

const existingRegimenCompletionItems = [
  "Current dose, interval, and infusion duration",
  "At least one measured vancomycin level",
  "Collection timing coherent with the entered dosing history",
];

function hasPatientCoreData(patient: typeof defaultPatient): boolean {
  return (
    patient.age > 0 &&
    patient.weight_kg > 0 &&
    patient.serum_creatinine_mg_dl > 0
  );
}

function SectionToggle({
  id,
  title,
  subtitle,
  completed,
  activeSection,
  onToggle,
}: {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
  activeSection: string;
  onToggle: (id: string) => void;
}) {
  const isActive = activeSection === id;

  return (
    <button
      type="button"
      className="mt-3 flex w-full items-center justify-between border px-4 py-3 text-left transition first:mt-0"
      style={
        isActive
          ? { background: "var(--color-highlight)", borderColor: "var(--color-primary-a50)", borderLeft: "3px solid var(--color-primary)" }
          : { background: "var(--color-card)", borderColor: "var(--color-border)" }
      }
      onClick={() => onToggle(id)}
      aria-expanded={isActive}
      aria-controls={`section-panel-${id}`}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--color-highlight)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--color-card)"; }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center border text-[11px] font-semibold"
          style={
            isActive
              ? { border: "1px solid var(--color-primary-a50)", background: "var(--color-primary-a15)", color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }
              : completed
                ? { border: "1px solid var(--color-primary-a40)", background: "var(--color-primary-a05)", color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }
                : { border: "1px solid var(--color-border)", background: "var(--color-input)", color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }
          }
        >
          {completed ? "OK" : "IN"}
        </span>
        <span>
          <span
            className="block text-sm font-semibold"
            style={{ color: isActive ? "var(--color-primary)" : "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}
          >
            {title}
          </span>
          <span
            className="mt-0.5 block text-xs"
            style={{ color: isActive ? "var(--color-secondary)" : "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}
          >
            {subtitle}
          </span>
        </span>
      </div>
      <span
        className="text-xs font-semibold uppercase tracking-[0.18em]"
        style={{
          color: isActive ? "var(--color-primary)" : completed ? "var(--color-secondary)" : "var(--color-dim)",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        {completed ? "READY" : "OPEN"}
      </span>
    </button>
  );
}

function SectionPanel({ id, activeSection, children }: { id: string; activeSection: string; children: ReactNode }) {
  const isActive = activeSection === id;

  return (
    <div
      id={`section-panel-${id}`}
      className={`overflow-hidden transition-all ${
        isActive ? "max-h-[2200px] px-4 pb-4 pt-3" : "max-h-0 px-4 pb-0 pt-0"
      }`}
      style={{ background: "var(--color-card)", borderLeft: "1px solid var(--color-border)", borderRight: "1px solid var(--color-border)", borderBottom: isActive ? "1px solid var(--color-border)" : "none" }}
    >
      {children}
    </div>
  );
}

function GraphReadinessState({
  mode,
  patientReady,
  regimenReady,
  levelReady,
}: {
  mode: CalculatorMode;
  patientReady: boolean;
  regimenReady: boolean;
  levelReady: boolean;
}) {
  const isExistingRegimen = mode === "existing_regimen";
  const items = isExistingRegimen ? existingRegimenCompletionItems : patientCompletionItems;
  const states = isExistingRegimen
    ? [patientReady, regimenReady, levelReady]
    : [patientReady, patientReady, patientReady];

  return (
    <section className="overflow-hidden border" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
      <div className="border-b px-6 py-5" style={{ borderBottomColor: "var(--color-border)", background: "var(--color-bg)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>&gt; MODEL-BACKED GRAPH ONLY</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>Complete the inputs to generate the concentration-time profile.</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-6" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
          The chart appears only after the dosing engine returns a fully calculated PK profile - not from client-side estimates.
        </p>
      </div>
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="border px-5 py-5" style={{ borderColor: "var(--color-primary-a25)", background: "var(--color-primary-a05)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>CLINICAL FRAMING</p>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
            The displayed profile represents the calculator&apos;s predicted vancomycin concentrations only after a full regimen calculation. AUC24 target attainment is assessed numerically from the PK model, not from a flat concentration band laid over the graph.
          </p>
        </div>
        <div className="border px-5 py-5" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>REQUIRED BEFORE GRAPHING</p>
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={item} className="flex items-start gap-3 border px-4 py-3" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                <span
                  className="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-[11px] font-bold"
                  style={states[index]
                    ? { background: "var(--color-primary-a12)", color: "var(--color-primary)", border: "1px solid var(--color-primary-a40)", fontFamily: "'Share Tech Mono', monospace" }
                    : { background: "var(--color-input)", color: "var(--color-dim)", border: "1px solid var(--color-border)", fontFamily: "'Share Tech Mono', monospace" }
                  }
                >
                  {states[index] ? "✓" : index + 1}
                </span>
                <span className="text-sm" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function getModeScopedFieldErrors(mode: CalculatorMode, fieldErrors?: Record<string, string>): Record<string, string> {
  if (!fieldErrors) return {};
  if (mode === "initial_regimen") {
    return Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => key.startsWith("patient.")));
  }
  return fieldErrors;
}

const SESSION_KEY = "vancomyzer_calculator_state";
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export default function CalculatorWorkspace() {
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("empiric");
  const [mode, setMode] = useState<CalculatorMode>("initial_regimen");
  const [patient, setPatient] = useState<typeof defaultPatient>(defaultPatient);
  const [rrt, setRrt] = useState<boolean | null>(null);
  const [regimen, setRegimen] = useState<CalculateRequestRegimen>(defaultRegimen);
  const [levels, setLevels] = useState<(typeof defaultLevel)[]>([{ ...defaultLevel }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CalculateErrorResponse | null>(null);
  const [result, setResult] = useState<CalculateResponse | null>(null);

  const [bedbound, setBedbound] = useState(false);
  const [bedboundDoseData, setBedboundDoseData] = useState<BedboundDoseData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const [lastInputChangedAt, setLastInputChangedAt] = useState<number | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<number | null>(null);
  const [selectedFrequencyOption, setSelectedFrequencyOption] = useState<FrequencyOption | null>(null);

  // Layout State
  const [activeSection, setActiveSection] = useState<string>("patient");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const { settings, playSound } = useMatrixSettings();

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
  useEffect(() => {
    if (didPreFillRef.current) return;
    const age = searchParams.get("age");
    const weight = searchParams.get("weight_kg");
    const scr = searchParams.get("serum_creatinine_mg_dl");
    if (age && weight && scr) {
      const parsedAge = Number(age);
      const parsedWeight = Number(weight);
      const parsedScr = Number(scr);
      if (parsedAge > 0 && parsedWeight > 0 && parsedScr > 0) {
        didPreFillRef.current = true;
        setPatient({ age: parsedAge, weight_kg: parsedWeight, serum_creatinine_mg_dl: parsedScr });
      }
    }
  }, [searchParams]);

  const buildRequest = useCallback((): CalculateRequest => {
    const base = { mode, patient: { ...patient } };
    if (mode === "initial_regimen") return base;
    // Filter out empty/zero levels (loading dose simulation has no measured levels)
    const validLevels = levels.filter(l => l.value_mcg_ml > 0);
    return { ...base, regimen, levels: validLevels };
  }, [mode, patient, regimen, levels]);

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

  const handleCalculate = useCallback(async () => {
    playSound("calculate");
    setError(null);
    setLoading(true);
    const request = buildRequest();

    try {
      console.log("[Vancomyzer] submitting levels:", JSON.stringify(request.levels));
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const fieldErrorDetails = data.field_errors && typeof data.field_errors === "object"
          ? Object.entries(data.field_errors as Record<string, string>).map(([field, message]) => `${field}: ${message}`)
          : [];
        setResult(null);
        setError({
          error_type: (data.error_type as CalculateErrorResponse["error_type"]) ?? "calculation_error",
          message: typeof data.message === "string" ? data.message : "Calculation request failed.",
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
      });
      setLastCalculatedAt(Date.now());
      setSelectedFrequencyOption(null);
      setError(null);
      playSound("success");

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
          `Trough (panel):     ${Number(panelTrough).toFixed(2)} mg/L\n` +
          `Trough (graph):     ${curveTrough.toFixed(2)} mg/L\n` +
          `Match: ${troughMatch ? "✓ PASS" : "✗ FAIL (Δ=" + Math.abs(panelTrough - curveTrough).toFixed(2) + ")"}\n\n` +
          `AUC24 (panel):      ${Number(panelAuc).toFixed(1)} mg·h/L\n` +
          `AUC24 (trapezoid):  ${trapAuc.toFixed(1)} mg·h/L\n` +
          `Δ: ${aucDelta.toFixed(1)} mg·h/L${aucMatch ? " — within tolerance" : " — EXCEEDS tolerance"}\n` +
          `Match: ${aucMatch ? "✓ PASS" : "✗ FAIL"}\n\n` +
          `Model: Colin 2019 Two-Compartment\n` +
          `τ: ${data.recommended_interval_hours ?? "?"}h\n` +
          `Infusion: ${data.recommended_infusion_duration_hours ?? "?"}h`
        );
      }
    } finally {
      setLoading(false);
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
    const timer = window.setTimeout(() => {
      void handleCalculate();
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
  const recommendedOption = visibleResult?.recommendation_type === "existing_regimen"
    ? (visibleResult.frequency_options?.find((o) => o.is_recommended) ?? null)
    : null;
  const activeOption = selectedFrequencyOption ?? recommendedOption;
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

  const handleSelectFrequency = useCallback((option: FrequencyOption) => {
    // Only update the visual display — do NOT touch regimen state, which would
    // trigger stale-result detection and wipe the graph.
    setSelectedFrequencyOption(option);
  }, []);

  const pendingLoadingDoseCalc = useRef(false);

  const handleSimulateLoadingDose = useCallback((doseMg: number, intervalHours: number, infusionHours: number) => {
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
    // API validation allows empty levels when doses_given=1
    setLevels([{ ...defaultLevel }]);
    setSelectedFrequencyOption(null);
    setResult(null);
    setError(null);
    setActiveSection("levels");
    pendingLoadingDoseCalc.current = true;
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
    navigator.clipboard.writeText(note).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {/* clipboard not available */});
  }, [activeOption, visibleResult]);

  const leftColumn = (
    <div className="flex flex-col h-full">
      <div className="mx-shimmer-border border p-5" style={{ borderTop: "3px solid var(--color-primary)", borderLeft: "1px solid var(--color-border)", borderRight: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)", background: "var(--color-card)" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>&gt; CLINICAL DATA INTAKE</p>
        <h2 className="mt-1.5 text-lg font-semibold tracking-tight" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>Enter patient data to begin.</h2>
        <p className="mt-1 text-sm leading-6" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
          Complete each section. The Bayesian engine runs automatically once enough data is present.
        </p>
      </div>

      <div className="flex flex-col flex-1 pb-24 pt-5">
        {/* Patient Section */}
        <div>
          <SectionToggle
            id="patient"
            title="Patient Information"
            subtitle="Adult demographics and renal function inputs"
            completed={patientReady}
            activeSection={activeSection}
            onToggle={(id) => setActiveSection(activeSection === id ? "" : id)}
          />
          <SectionPanel id="patient" activeSection={activeSection}>
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
              />
          </SectionPanel>
        </div>

        {/* Regimen Section — only shown in existing_regimen mode */}
        {mode === "existing_regimen" && (
          <div>
            <SectionToggle
              id="regimen"
              title="Dosing History"
              subtitle="Current maintenance regimen being evaluated"
              completed={regimenReady}
              activeSection={activeSection}
              onToggle={(id) => setActiveSection(activeSection === id ? "" : id)}
            />
            <SectionPanel id="regimen" activeSection={activeSection}>
              <div className="flex flex-col gap-4">
                <RegimenForm value={regimen} onChange={setRegimen} fieldErrors={fieldErrors} />
              </div>
            </SectionPanel>
          </div>
        )}

        {/* Levels Section (if applicable) */}
        {mode === "existing_regimen" && (
          <div>
            <SectionToggle
              id="levels"
              title="Drug Levels"
              subtitle="Measured concentrations used for posterior refinement"
              completed={levelReady}
              activeSection={activeSection}
              onToggle={(id) => setActiveSection(activeSection === id ? "" : id)}
            />
            <SectionPanel id="levels" activeSection={activeSection}>
              {/* Bedbound two-phase banner */}
              {bedbound && (
                <div className="mb-3">
                  {!bedboundLevelComplete ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-lg">⏳</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Phase 1 complete — awaiting level</p>
                        <p className="mt-0.5 text-xs text-amber-800 leading-5">
                          Loading dose has been recorded. Draw the vancomycin level per the timing in the Bedbound panel,
                          then enter the concentration, date, and time below.
                          The <strong>Calculate</strong> button will unlock once the level is entered.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-lg">✓</span>
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">Phase 2 — level entered, ready to calculate</p>
                        <p className="mt-0.5 text-xs text-emerald-800 leading-5">
                          Vancomycin level received. Press <strong>Calculate</strong> to run the Bayesian engine
                          and receive a maintenance regimen recommendation.
                        </p>
                      </div>
                    </div>
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
            </SectionPanel>
          </div>
        )}

        {/* Calculation Settings */}
        <div>
          <SectionToggle
            id="settings"
            title="Calculation Method"
            subtitle="Workflow status, evidence grade, and safety framing"
            completed={true}
            activeSection={activeSection}
            onToggle={(id) => setActiveSection(activeSection === id ? "" : id)}
          />
          <SectionPanel id="settings" activeSection={activeSection}>
            <CalculationMethodPanel mode={mode} levelCount={levels.length} details={visibleResult?.calculation_details} assumptions={visibleResult?.assumptions} infusionDurationAdjustedForSafety={visibleResult?.infusion_duration_adjusted_for_safety} />
          </SectionPanel>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto border-t" style={{ borderTopColor: "var(--color-border)", background: "var(--color-bg)" }}>
        <CalculatorActionBar onCalculate={handleCalculate} onReset={handleReset} disabled={loading || rrt === null || rrt === true} hideCalculate={hideCalculate} />
        {/* Inline disclaimer — always visible */}
        <div className="border-t px-4 py-2" style={{ borderTopColor: "var(--color-border)" }}>
          <p style={{ fontSize: 10, lineHeight: 1.6, color: "var(--color-dim)", fontFamily: "inherit", margin: 0 }}>
            Disclaimer: This tool is for informational purposes only and intended for use exclusively by licensed healthcare professionals. THE TOOL IS NOT INTENDED TO BE A SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE, DOSING, DIAGNOSIS OR TREATMENT.{" "}
            <span
              style={{ color: "var(--color-primary)", cursor: "pointer", textDecoration: "none" }}
              onClick={() => setDisclaimerOpen(true)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
            >
              [See Full Disclaimer]
            </span>
          </p>
        </div>
        {/* Footer links + copyright */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t px-4 py-2" style={{ borderTopColor: "var(--color-border)" }}>
          {[
            { href: "/disclaimer", label: "Disclaimer" },
            { href: "/terms", label: "Terms" },
            { href: "/privacy", label: "Privacy" },
            { href: "/about", label: "About" },
            { href: "/contact", label: "Contact" },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="text-[10px] transition-colors" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-dim)"; }}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="border-t px-4 py-1.5" style={{ borderTopColor: "var(--color-border)", textAlign: "center" }}>
          <span style={{ fontSize: 10, color: "var(--color-dim)", fontFamily: "inherit" }}>
            {"\u00A9"} 2026 Vancomyzer{"\u2122"} {"\u00B7"} Engineered by D{"\u014D"}sys{"\u2122"} {"\u00B7"} All Rights Reserved
          </span>
        </div>
      </div>
    </div>
  );

  const rightColumn = (
    <div className="flex flex-col h-full gap-6">
      <div className="border-l-4 border px-4 py-3 flex items-center gap-3" style={{ borderLeftColor: "var(--color-primary)", borderColor: "var(--color-border)", background: "var(--color-card)" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}>&gt; ANALYSIS WORKSPACE</p>
          <h2 className="text-sm font-semibold leading-snug" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>Model outputs, exposure metrics &amp; regimen guidance</h2>
        </div>
      </div>

      {hasStaleResult && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Draft inputs changed after the last PK run.</p>
          <p className="mt-1 text-sm text-amber-800">Recalculate before using the exposure metrics or concentration-time graph for review.</p>
        </div>
      )}

      {/* Age >65 advisory — non-blocking, shown whenever age is entered */}
      {patient.age > 65 && !rrt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-amber-900">Age &gt;65 — Enhanced Monitoring Advisory</p>
            <p className="mt-0.5 text-xs text-amber-800 leading-5">
              The Colin 2019 model includes an age-decline function (FDecline), but renal function in older adults may decline faster than SCr reflects — especially in patients with low muscle mass. Consider:
            </p>
            <ul className="mt-1 text-xs text-amber-800 leading-5 list-disc pl-4 space-y-0.5">
              <li>More frequent vancomycin level monitoring (every 24–48h rather than 72h)</li>
              <li>Daily SCr to detect early renal deterioration</li>
              <li>If SCr appears low relative to clinical status, consider cystatin C or SCr floor</li>
              <li>External validation data suggest Colin 2019 performs best in adults 18–64; level-based Bayesian refinement is especially important for patients &gt;65</li>
            </ul>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex justify-center items-center min-h-[400px]">
          <CalculatorLoadingState />
        </div>
      )}

      {!loading && error && (
        <div className="border p-6" style={{ background: "var(--color-card)", borderColor: "rgba(255,51,51,0.5)" }}>
          <CalculatorErrorState message={error.message} details={error.details} limitations={error.limitations} recoveryGuidance={error.recovery_guidance} fallbackWorkflow={error.fallback_workflow} onSwitchToInitialRegimen={handleSwitchToInitialRegimen} />
        </div>
      )}

      {!loading && !error && (
        <CalculatorResultState hasResult={visibleResult != null}>
          {visibleResult ? (
            <div className="flex flex-col gap-3">

              {/* Row 1: Dose tabs + AUC/Peak/Trough — compact horizontal */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">

                {/* Left: Dose recommendation with frequency tabs */}
                <div className="overflow-hidden border" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                  <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderBottomColor: "var(--color-border)", background: "var(--color-bg)" }}>
                    <span className="text-[15px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--color-primary)" }}>SUGGESTED DOSE<span className="mx-blink" style={{ color: "var(--color-primary)" }}>_</span></span>
                    <div className="flex items-center gap-2">
                      {(activeOption?.clinical_note ?? visibleResult.documentation_preview?.clinical_note) && (
                        <button
                          type="button"
                          onClick={handleCopyNote}
                          className="border px-2 py-0.5 text-[10px] font-semibold transition-colors"
                          style={{ borderColor: "var(--color-border)", background: "transparent", color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}
                        >
                          {copySuccess ? "COPIED" : "COPY NOTE"}
                        </button>
                      )}
                      <ResultScopeBanner recommendation_type={visibleResult.recommendation_type} />
                    </div>
                  </div>
                  <div className="p-2">
                    <DoseRecommendationCard
                      recommended_dose={visibleResult.recommended_dose}
                      recommended_interval_hours={visibleResult.recommended_interval_hours}
                      recommendation_type={visibleResult.recommendation_type}
                      calculationDetails={visibleResult.calculation_details}
                      recommended_infusion_duration_hours={visibleResult.recommended_infusion_duration_hours}
                      infusion_duration_adjusted_for_safety={visibleResult.infusion_duration_adjusted_for_safety}
                      infusion_safety_note={visibleResult.infusion_safety_note}
                      frequency_options={visibleResult.frequency_options}
                      draftDiffersFromCalculated={hasStaleResult}
                      onApplyRecommendation={handleApplyRecommendedRegimen}
                      onApplyFrequency={(option) => {
                        setRegimen((current) => ({
                          ...current,
                          dose_mg: option.dose_mg,
                          interval_hours: option.interval_hours,
                          infusion_duration_hours: option.infusion_duration_hours || (current.infusion_duration_hours > 0 ? current.infusion_duration_hours : 1),
                        }));
                      }}
                      onSelectFrequency={handleSelectFrequency}
                      onSimulateLoadingDose={handleSimulateLoadingDose}
                      patientWeightKg={patient.weight_kg > 0 ? patient.weight_kg : null}
                    />
                  </div>
                </div>

                {/* Right: Predicted PK metrics — compact column */}
                <div className="overflow-hidden border" style={{ borderColor: "var(--color-border)", background: "var(--color-card)", minWidth: 280 }}>
                  <div className="border-b px-3 py-1.5" style={{ borderBottomColor: "var(--color-border)", background: "var(--color-bg)" }}>
                    <span className="text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--color-primary)" }}>PREDICTED PK</span>
                  </div>
                  <div className="p-2 flex flex-col gap-2">
                    {(() => {
                      const auc24 = activeOption?.auc24 ?? visibleResult.auc24;
                      const peak  = activeOption?.peak  ?? visibleResult.peak;
                      const trough = activeOption?.trough ?? visibleResult.trough;
                      return <PrimaryMetricsCard auc24={auc24} peak={peak} trough={trough} />;
                    })()}
                    {visibleResult.pk_parameters && (
                      <div className="border px-3 py-2" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
                        <PKParametersMath params={visibleResult.pk_parameters} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Graph — immediately visible */}
              <section className="overflow-hidden border" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                <div className="p-2">
                  <ConcentrationTimeGraph
                    curve={activeOption?.curve ?? visibleResult.curve}
                    measured_levels={visibleResult.measured_levels}
                    calculationDetails={visibleResult.calculation_details}
                  />
                </div>
              </section>

              {/* Row 3: Clinical Signal Strip */}
              {visibleResult.calculation_details && (
                <ClinicalSignalStrip
                  auc24={activeOption?.auc24 ?? visibleResult.auc24}
                  trough={activeOption?.trough ?? visibleResult.trough}
                  details={visibleResult.calculation_details}
                />
              )}

              {/* Row 4: Clinical Interpretation + Details — all collapsed */}
              <details className="group border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
                <summary className="cursor-pointer text-[11px] font-semibold flex items-center outline-none list-none uppercase tracking-[0.1em]" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>
                  <svg className="w-3.5 h-3.5 mr-2 transition-transform group-open:rotate-90" style={{ color: "var(--color-dim)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  CLINICAL INTERPRETATION &amp; DOCUMENTATION
                </summary>
                <div className="mt-3 flex flex-col gap-3 border-t pt-3" style={{ borderTopColor: "var(--color-border)" }}>
                  <InterpretationSummaryCard
                    interpretation_summary={
                      activeOption?.interpretation_summary ?? visibleResult.interpretation_summary
                    }
                  />
                  <CalculationDetailsCard details={visibleResult.calculation_details} />
                  <ClinicalNotePreview
                    clinical_note={
                      activeOption?.clinical_note ?? visibleResult.documentation_preview?.clinical_note
                    }
                  />
                  <AssumptionsCard assumptions={visibleResult.assumptions} calculationDetails={visibleResult.calculation_details} />
                  <LimitationsCard limitations={visibleResult.limitations} calculationDetails={visibleResult.calculation_details} />
                </div>
              </details>
            </div>
          ) : (
            <div className="flex flex-col gap-6 flex-1 h-full pb-8">
              <section className="flex h-[220px] flex-col items-center justify-center border border-dashed p-8 text-center" style={{ borderColor: "var(--color-primary-a30)", background: "var(--color-card)" }}>
                <p className="text-lg font-medium" style={{ color: "var(--color-secondary)", fontFamily: "'Share Tech Mono', monospace" }}>
                  &gt; AWAITING INPUT<span className="mx-blink" style={{ color: "var(--color-primary)" }}>_</span>
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}>Complete the required inputs to generate exposure metrics and a model-backed concentration profile.</p>
              </section>
              <GraphReadinessState mode={mode} patientReady={patientReady} regimenReady={regimenReady} levelReady={levelReady} />
            </div>
          )}
        </CalculatorResultState>
      )}
    </div>
  );

  return (
    <div className="relative flex h-screen flex-col overflow-hidden" style={{ background: "transparent", color: "var(--color-primary)" }}>
      <CalculatorHeader viewMode={viewMode} onViewModeChange={applyViewMode} onSettingsOpen={() => setSettingsOpen(true)} />
      <div className="flex-1 overflow-hidden h-full">
        <CalculatorLayout left={leftColumn} right={rightColumn} />
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DisclaimerModal open={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} />
    </div>
  );
}
