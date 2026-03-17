"use client";

import { useState, useCallback } from "react";
import type {
  CalculatorMode,
  CalculateRequest,
  CalculateResponse,
  CalculateErrorResponse,
} from "@/types/calculator";
import CalculatorHeader from "@/components/calculator/CalculatorHeader";
import CalculatorLayout from "@/components/calculator/CalculatorLayout";
import PatientCharacteristicsForm from "@/components/calculator/PatientCharacteristicsForm";
import RegimenForm from "@/components/calculator/RegimenForm";
import LevelEntryTable from "@/components/calculator/LevelEntryTable";
import CalculatorActionBar from "@/components/calculator/CalculatorActionBar";
import PrimaryMetricsCard from "@/components/calculator/PrimaryMetricsCard";
import DoseRecommendationCard from "@/components/calculator/DoseRecommendationCard";
import InterpretationSummaryCard from "@/components/calculator/InterpretationSummaryCard";
import AssumptionsCard from "@/components/calculator/AssumptionsCard";
import LimitationsCard from "@/components/calculator/LimitationsCard";
import ConcentrationTimeGraph from "@/components/calculator/ConcentrationTimeGraph";
import QuickSummaryPreview from "@/components/calculator/QuickSummaryPreview";
import ClinicalNotePreview from "@/components/calculator/ClinicalNotePreview";
import CalculatorLoadingState from "@/components/calculator/CalculatorLoadingState";
import CalculatorErrorState from "@/components/calculator/CalculatorErrorState";
import CalculatorResultState from "@/components/calculator/CalculatorResultState";

const defaultPatient = {
  age: 0,
  sex: "",
  height_cm: 0,
  weight_kg: 0,
  serum_creatinine_mg_dl: 0,
};

const defaultRegimen = {
  dose_mg: 0,
  interval_hours: 0,
  infusion_duration_hours: 0,
};

const defaultLevel = {
  value_mcg_ml: 0,
  collection_time: "",
  time_since_last_dose_hours: 0,
};

export default function CalculatorPage() {
  const [mode, setMode] = useState<CalculatorMode>("initial_regimen");
  const [patient, setPatient] = useState(defaultPatient);
  const [regimen, setRegimen] = useState(defaultRegimen);
  const [levels, setLevels] = useState([{ ...defaultLevel }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CalculateErrorResponse | null>(null);
  const [result, setResult] = useState<CalculateResponse | null>(null);

  const buildRequest = useCallback((): CalculateRequest => {
    const base = {
      mode,
      patient: {
        ...patient,
        sex: patient.sex || "male",
      },
    };
    if (mode === "initial_regimen") {
      return base;
    }
    return {
      ...base,
      regimen,
      levels: levels.map((l) => ({
        ...l,
        collection_time: l.collection_time || new Date().toISOString(),
      })),
    };
  }, [mode, patient, regimen, levels]);

  const handleCalculate = useCallback(async () => {
    setError(null);
    setResult(null);
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
        setResult(null);
        setError({
          error_type: (data.error_type as CalculateErrorResponse["error_type"]) ?? "calculation_error",
          message: typeof data.message === "string" ? data.message : "Calculation request failed.",
          field_errors: data.field_errors,
          details: data.details,
          limitations: data.limitations,
        });
        return;
      }

      setError(null);
      setResult({
        recommendation_type: data.recommendation_type === "existing_regimen" ? "existing_regimen" : "initial_regimen",
        auc24: data.auc24 ?? 0,
        peak: data.peak ?? 0,
        trough: data.trough ?? 0,
        recommended_dose: data.recommended_dose ?? "",
        recommended_interval_hours: data.recommended_interval_hours ?? 0,
        interpretation_summary: data.interpretation_summary ?? "",
        assumptions: Array.isArray(data.assumptions) ? data.assumptions : [],
        limitations: Array.isArray(data.limitations) ? data.limitations : [],
        curve: Array.isArray(data.curve) ? data.curve : [],
        measured_levels: Array.isArray(data.measured_levels) ? data.measured_levels : [],
        documentation_preview: data.documentation_preview,
      });
    } finally {
      setLoading(false);
    }
  }, [buildRequest]);

  const handleReset = useCallback(() => {
    setPatient({ ...defaultPatient });
    setRegimen({ ...defaultRegimen });
    setLevels([{ ...defaultLevel }]);
    setError(null);
    setResult(null);
  }, []);

  const rightColumn = (
    <>
      {loading && <CalculatorLoadingState />}
      {!loading && error && (
        <CalculatorErrorState
          message={error.message}
          details={error.details}
          limitations={error.limitations}
        />
      )}
      {!loading && !error && (
        <CalculatorResultState hasResult={result != null}>
          {result != null && (
            <>
              <PrimaryMetricsCard
                auc24={result.auc24}
                peak={result.peak}
                trough={result.trough}
              />
              <DoseRecommendationCard
                recommended_dose={result.recommended_dose}
                recommended_interval_hours={result.recommended_interval_hours}
              />
              <InterpretationSummaryCard
                interpretation_summary={result.interpretation_summary}
              />
              <AssumptionsCard assumptions={result.assumptions} />
              <LimitationsCard limitations={result.limitations} />
              <ConcentrationTimeGraph
                curve={result.curve}
                measured_levels={result.measured_levels}
              />
              <QuickSummaryPreview
                quick_summary={result.documentation_preview?.quick_summary}
              />
              <ClinicalNotePreview
                clinical_note={result.documentation_preview?.clinical_note}
              />
            </>
          )}
        </CalculatorResultState>
      )}
    </>
  );

  const leftColumn = (
    <>
      <PatientCharacteristicsForm value={patient} onChange={setPatient} />
      {mode === "existing_regimen" && (
        <>
          <RegimenForm value={regimen} onChange={setRegimen} />
          <LevelEntryTable levels={levels} onChange={setLevels} />
        </>
      )}
      <CalculatorActionBar
        onCalculate={handleCalculate}
        onReset={handleReset}
        disabled={loading}
      />
    </>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CalculatorHeader />
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4" aria-label="Workflow selector">
        <h2 className="text-sm font-semibold text-gray-700">Workflow</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="calculator-mode"
              checked={mode === "initial_regimen"}
              onChange={() => setMode("initial_regimen")}
              className="h-4 w-4 border-gray-300 text-gray-900"
            />
            <span className="text-sm text-gray-900">Initial regimen recommendation</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="calculator-mode"
              checked={mode === "existing_regimen"}
              onChange={() => setMode("existing_regimen")}
              className="h-4 w-4 border-gray-300 text-gray-900"
            />
            <span className="text-sm text-gray-900">Existing regimen evaluation / adjustment</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {mode === "initial_regimen"
            ? "Patient characteristics only. No current dose or levels required."
            : "Patient, current regimen, and at least one level required."}
        </p>
      </section>
      <CalculatorLayout left={leftColumn} right={rightColumn} />
    </div>
  );
}
