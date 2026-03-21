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

function estimateCrCl(patient: CalculateRequestPatient): number | null {
  const { age, weight_kg, serum_creatinine_mg_dl, sex } = patient;
  if (!age || !weight_kg || !serum_creatinine_mg_dl || !sex) return null;
  const base = ((140 - age) * weight_kg) / (72 * serum_creatinine_mg_dl);
  return sex === "female" ? base * 0.85 : base;
}

function roundedDose(weight: number): number {
  if (!weight || weight <= 0) return 1000;
  if (weight < 55) return 750;
  if (weight < 95) return 1000;
  return 1250;
}

export default function RegimenSuggestionCard({ mode, patient, onApply, statMode = false }: RegimenSuggestionCardProps) {
  const crcl = estimateCrCl(patient);
  const baseDose = roundedDose(patient.weight_kg);
  const suggestion: CalculateRequestRegimen = {
    dose_mg: baseDose,
    interval_hours: crcl == null ? 12 : crcl >= 60 ? 12 : crcl >= 30 ? 24 : 36,
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
