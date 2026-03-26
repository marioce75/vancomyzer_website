"use client";

import type {
  CalculateRequestPatient,
  CalculateRequestRegimen,
  CalculatorMode,
} from "@/types/calculator";

interface RegimenSuggestionCardProps {
  mode: CalculatorMode;
  patient: CalculateRequestPatient;
  onApply: (regimen: CalculateRequestRegimen) => void;
  statMode?: boolean;
}

function estimateScrBasedInterval(patient: CalculateRequestPatient): number | null {
  const { age, weight_kg, serum_creatinine_mg_dl } = patient;
  if (!age || !weight_kg || !serum_creatinine_mg_dl) return null;
  // Simple SCr-based heuristic: higher SCr → longer interval
  if (serum_creatinine_mg_dl >= 3.0) return 48;
  if (serum_creatinine_mg_dl >= 2.0) return 36;
  if (serum_creatinine_mg_dl >= 1.5) return 24;
  return 12;
}

function roundedDose(weight: number): number {
  if (!weight || weight <= 0) return 1000;
  if (weight < 55) return 750;
  if (weight < 95) return 1000;
  return 1250;
}

export default function RegimenSuggestionCard({ mode, patient, onApply, statMode = false }: RegimenSuggestionCardProps) {
  const interval = estimateScrBasedInterval(patient);
  const baseDose = roundedDose(patient.weight_kg);
  const suggestion: CalculateRequestRegimen = {
    dose_mg: baseDose,
    interval_hours: interval ?? 12,
    infusion_duration_hours: baseDose >= 1250 ? 1.5 : 1,
  };

  return (
    <details className="border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">
        Optional regimen scaffold
      </summary>
      {!statMode && <p className="mt-1 text-xs text-slate-500">Heuristic only. Confirm with full calculation.</p>}
      <div className="mt-2">
        <button type="button" onClick={() => onApply(suggestion)} className="w-full border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50">
          {suggestion.dose_mg} mg q{suggestion.interval_hours}h · infusion {suggestion.infusion_duration_hours} h
        </button>
      </div>
    </details>
  );
}
