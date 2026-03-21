"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import type {
  CalculatorMode,
  CalculateRequest,
  CalculateResponse,
  CalculateErrorResponse,
  FrequencyOption,
} from "@/types/calculator";
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
import QuickSummaryPreview from "@/components/calculator/QuickSummaryPreview";
import ClinicalNotePreview from "@/components/calculator/ClinicalNotePreview";
import CalculatorLoadingState from "@/components/calculator/CalculatorLoadingState";
import CalculatorErrorState from "@/components/calculator/CalculatorErrorState";
import CalculatorResultState from "@/components/calculator/CalculatorResultState";
import ResultScopeBanner from "@/components/calculator/ResultScopeBanner";
import CalculationDetailsCard from "@/components/calculator/CalculationDetailsCard";
import DataFitReviewabilityPanel from "@/components/calculator/DataFitReviewabilityPanel";
import RegimenSuggestionCard from "@/components/calculator/RegimenSuggestionCard";

const defaultPatient = { age: 0, sex: "", height_cm: 0, weight_kg: 0, serum_creatinine_mg_dl: 0 };
const defaultRegimen = { dose_mg: 0, interval_hours: 0, infusion_duration_hours: 0 };
const defaultLevel = { value_mcg_ml: 0, collection_time: "", time_since_last_dose_hours: 0 };

type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

const patientCompletionItems = [
  "Age, sex, height, weight, and serum creatinine",
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
    patient.height_cm > 0 &&
    patient.weight_kg > 0 &&
    patient.serum_creatinine_mg_dl > 0 &&
    !!patient.sex
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
      className={`mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition first:mt-0 ${
        isActive
          ? "border-slate-300 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={() => onToggle(id)}
      aria-expanded={isActive}
      aria-controls={`section-panel-${id}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
            isActive
              ? "border-white/20 bg-white/10 text-white"
              : completed
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {completed ? "OK" : "IN"}
        </span>
        <span>
          <span className={`block text-sm font-semibold ${isActive ? "text-white" : "text-slate-900"}`}>{title}</span>
          <span className={`mt-0.5 block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>{subtitle}</span>
        </span>
      </div>
      <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${isActive ? "text-slate-300" : completed ? "text-emerald-700" : "text-slate-400"}`}>
        {completed ? "Ready" : "Open"}
      </span>
    </button>
  );
}

function SectionPanel({ id, activeSection, children }: { id: string; activeSection: string; children: ReactNode }) {
  const isActive = activeSection === id;

  return (
    <div
      id={`section-panel-${id}`}
      className={`overflow-hidden rounded-b-2xl border-x border-b border-slate-200 bg-white transition-all ${
        isActive ? "max-h-[2200px] px-4 pb-4 pt-3" : "max-h-0 px-4 pb-0 pt-0"
      }`}
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
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_48px_-24px_rgba(15,23,42,0.35)]">
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.16),_transparent_58%),linear-gradient(90deg,rgba(15,23,42,0.04),rgba(15,23,42,0))]" />
      <div className="relative border-b border-slate-200 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Model-backed graph only</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Concentration-time profile withheld until the calculator can produce a defensible PK run.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Vancomyzer no longer draws a provisional concentration curve from shortcut client-side math. The chart appears only after the dosing engine returns a calculated PK profile from the same workflow used for exposure outputs.
        </p>
      </div>
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-5 text-slate-50">
          <p className="text-sm font-semibold text-cyan-300">Clinical framing</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            The displayed profile represents the calculator’s predicted vancomycin concentrations only after a full regimen calculation. AUC24 target attainment is assessed numerically from the PK model, not from a flat concentration band laid over the graph.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
          <p className="text-sm font-semibold text-slate-900">Required before graphing</p>
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${states[index] ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {states[index] ? "✓" : index + 1}
                </span>
                <span className="text-sm text-slate-700">{item}</span>
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

export default function CalculatorWorkspace() {
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("empiric");
  const [mode, setMode] = useState<CalculatorMode>("initial_regimen");
  const [patient, setPatient] = useState(defaultPatient);
  const [regimen, setRegimen] = useState(defaultRegimen);
  const [levels, setLevels] = useState([{ ...defaultLevel }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CalculateErrorResponse | null>(null);
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [statMode, setStatMode] = useState(false);
  const [lastInputChangedAt, setLastInputChangedAt] = useState<number | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<number | null>(null);

  // Layout State
  const [activeSection, setActiveSection] = useState<string>("patient");

  const buildRequest = useCallback((): CalculateRequest => {
    const base = { mode, patient: { ...patient } };
    if (mode === "initial_regimen") return base;
    return { ...base, regimen, levels };
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
    setError(null);
    setLoading(true);
    const request = buildRequest();

    try {
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
      });
      setLastCalculatedAt(Date.now());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [buildRequest]);

  useEffect(() => {
    setLastInputChangedAt(Date.now());
  }, [patient, regimen, levels, mode]);

  useEffect(() => {
    const hasPatientCore = patient.age > 0 && patient.height_cm > 0 && patient.weight_kg > 0 && patient.serum_creatinine_mg_dl > 0 && !!patient.sex;
    if (!hasPatientCore || mode !== "initial_regimen") return;
    const timer = window.setTimeout(() => {
      void handleCalculate();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [patient, mode, handleCalculate]);

  const handleReset = useCallback(() => {
    setPatient({ ...defaultPatient });
    setRegimen({ ...defaultRegimen });
    setLevels([{ ...defaultLevel }]);
    setError(null);
    setResult(null);
    setViewMode("empiric");
    setMode("initial_regimen");
    setLastCalculatedAt(null);
    setActiveSection("patient");
  }, []);

  const fieldErrors = getModeScopedFieldErrors(mode, error?.field_errors);
  const handleSwitchToInitialRegimen = useCallback(() => applyViewMode("empiric"), [applyViewMode]);

  const hasStaleResult = Boolean(result && lastCalculatedAt && lastInputChangedAt && lastInputChangedAt > lastCalculatedAt);
  const visibleResult = hasStaleResult ? null : result;
  const patientReady = hasPatientCoreData(patient);
  const regimenReady = regimen.dose_mg > 0 && regimen.interval_hours > 0 && regimen.infusion_duration_hours > 0;
  const levelReady = levels.some((level) => level.value_mcg_ml > 0 && level.time_since_last_dose_hours >= 0);

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
    setRegimen((current) => ({
      ...current,
      dose_mg: option.dose_mg,
      interval_hours: option.interval_hours,
      infusion_duration_hours: option.infusion_duration_hours || (current.infusion_duration_hours > 0 ? current.infusion_duration_hours : 1),
    }));
  }, []);

  const leftColumn = (
    <div className="flex flex-col h-full">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5 shadow-[0_14px_38px_-24px_rgba(15,23,42,0.3)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Clinical data intake</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Enter a defensible dosing context before calculating.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The calculator will only show a concentration-time profile after the model has enough data to generate a real PK run.
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
            <PatientCharacteristicsForm value={patient} onChange={setPatient} fieldErrors={fieldErrors} />
          </SectionPanel>
        </div>

        {/* Regimen Section */}
        <div>
          <SectionToggle
            id="regimen"
            title={mode === "existing_regimen" ? "Dosing History" : "Suggested Scaffold"}
            subtitle={mode === "existing_regimen" ? "Current maintenance regimen being evaluated" : "Use the modeled recommendation as your maintenance draft"}
            completed={mode === "existing_regimen" ? regimenReady : Boolean(result?.recommended_dose)}
            activeSection={activeSection}
            onToggle={(id) => setActiveSection(activeSection === id ? "" : id)}
          />
          <SectionPanel id="regimen" activeSection={activeSection}>
            {mode === "existing_regimen" ? (
              <div className="flex flex-col gap-4">
                <RegimenForm value={regimen} onChange={setRegimen} fieldErrors={fieldErrors} />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="mb-2 text-sm leading-6 text-slate-500">Empiric mode uses the population model to generate the maintenance recommendation once the patient section is complete.</p>
                {!statMode && <RegimenSuggestionCard mode={mode} patient={patient} onApply={setRegimen} statMode={statMode} />}
              </div>
            )}
          </SectionPanel>
        </div>

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
              <LevelEntryTable levels={levels} onChange={setLevels} fieldErrors={fieldErrors} />
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
            {!statMode && (
              <CalculationMethodPanel mode={mode} levelCount={levels.length} details={visibleResult?.calculation_details} assumptions={visibleResult?.assumptions} infusionDurationAdjustedForSafety={visibleResult?.infusion_duration_adjusted_for_safety} />
            )}
          </SectionPanel>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <CalculatorActionBar onCalculate={handleCalculate} onReset={handleReset} disabled={loading} />
      </div>
    </div>
  );

  const rightColumn = (
    <div className="flex flex-col h-full gap-6">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,1)_0%,rgba(15,23,42,0.94)_58%,rgba(8,145,178,0.88)_100%)] px-6 py-6 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.7)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">Analysis workspace</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Model outputs, exposure metrics, and regimen guidance.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
            Every displayed concentration-time curve is sourced from the dosing engine output. If the draft inputs no longer match the last run, the recommendation is withheld until recalculation.
          </p>
        </div>
      </div>

      {hasStaleResult && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Draft inputs changed after the last PK run.</p>
          <p className="mt-1 text-sm text-amber-800">Recalculate before using the exposure metrics or concentration-time graph for review.</p>
        </div>
      )}
      
      {loading && (
        <div className="flex-1 flex justify-center items-center min-h-[400px]">
          <CalculatorLoadingState />
        </div>
      )}
      
      {!loading && error && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
          <CalculatorErrorState message={error.message} details={error.details} limitations={error.limitations} recoveryGuidance={error.recovery_guidance} fallbackWorkflow={error.fallback_workflow} onSwitchToInitialRegimen={handleSwitchToInitialRegimen} />
        </div>
      )}

      {!loading && !error && (
        <CalculatorResultState hasResult={visibleResult != null}>
          {visibleResult ? (
            <div className="flex flex-col gap-6">
              
              {/* Top Row: Dosing and Metrics */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="flex flex-col h-full">
                  <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suggested Dose</h3>
                  <div className="flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                      <span className="font-semibold text-slate-800 text-sm">Target Attainment</span>
                      <ResultScopeBanner recommendation_type={visibleResult.recommendation_type} />
                    </div>
                    <div className="p-4">
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
                        onSelectFrequency={handleSelectFrequency}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col h-full">
                  <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-500">Predicted PK</h3>
                  <div className="flex-1 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
                    <PrimaryMetricsCard auc24={visibleResult.auc24} peak={visibleResult.peak} trough={visibleResult.trough} />
                  </div>
                </div>
              </div>

              {/* Main Graph Area */}
              <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-900 m-0">Concentration-Time Profile</h2>
                </div>
                <div className="p-5 pt-3 min-h-[400px]">
                  <ConcentrationTimeGraph curve={visibleResult.curve} measured_levels={visibleResult.measured_levels} calculationDetails={visibleResult.calculation_details} />
                </div>
              </section>

              {/* Bottom Details Grid */}
              {!statMode && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                  <div className="h-full rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
                    <h3 className="text-md font-bold text-slate-900 mb-4 border-b pb-2">Kinetic Parameters</h3>
                    <DataFitReviewabilityPanel details={visibleResult.calculation_details} />
                    <div className="mt-4">
                      <CalculationDetailsCard details={visibleResult.calculation_details} />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-6 h-full">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
                      <h3 className="text-md font-bold text-slate-900 mb-4 border-b pb-2">Clinical Interpretation</h3>
                      <InterpretationSummaryCard interpretation_summary={visibleResult.interpretation_summary} />
                      <div className="mt-4">
                        <ClinicalSignalStrip auc24={visibleResult.auc24} trough={visibleResult.trough} details={visibleResult.calculation_details} />
                      </div>
                    </div>
                    
                    <details className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700 flex items-center outline-none">
                        <svg className="w-4 h-4 mr-2 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Documentation & Disclaimers
                      </summary>
                      <div className="mt-4 flex flex-col gap-4 border-t pt-4">
                        <QuickSummaryPreview quick_summary={visibleResult.documentation_preview?.quick_summary} />
                        <ClinicalNotePreview clinical_note={visibleResult.documentation_preview?.clinical_note} />
                        <AssumptionsCard assumptions={visibleResult.assumptions} calculationDetails={visibleResult.calculation_details} />
                        <LimitationsCard limitations={visibleResult.limitations} calculationDetails={visibleResult.calculation_details} />
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6 flex-1 h-full pb-8">
              <section className="flex h-[220px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
                <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium text-slate-700">Complete the required inputs to generate exposure metrics and a model-backed concentration profile.</p>
              </section>
              <GraphReadinessState mode={mode} patientReady={patientReady} regimenReady={regimenReady} levelReady={levelReady} />
            </div>
          )}
        </CalculatorResultState>
      )}
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3f9_100%)] text-slate-900">
      <CalculatorHeader statMode={statMode} onToggleStatMode={() => setStatMode((value) => !value)} viewMode={viewMode} onViewModeChange={applyViewMode} />
      <div className="flex-1 overflow-hidden h-full">
        <CalculatorLayout left={leftColumn} right={rightColumn} />
      </div>
    </div>
  );
}
