import React from "react";
import { CalculationDetails, FrequencyOption } from "@/types/calculator";

interface DoseRecommendationCardProps {
  recommended_dose?: string | null;
  recommended_interval_hours?: number | null;
  recommended_infusion_duration_hours?: number | null;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string | null;
  recommendation_type?: "initial_regimen" | "existing_regimen" | null;
  calculationDetails?: CalculationDetails | null;
  frequency_options?: FrequencyOption[] | null;
  draftDiffersFromCalculated?: boolean;
  onApplyRecommendation?: (() => void) | null;
  onSelectFrequency?: ((option: FrequencyOption) => void) | null;
}

function aucRangeLabel(auc: number): { label: string; color: string } {
  if (auc >= 400 && auc <= 600) return { label: "In range", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (auc > 600) return { label: "Above target", color: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Below target", color: "text-rose-700 bg-rose-50 border-rose-200" };
}

export default function DoseRecommendationCard({
  recommended_dose,
  recommended_interval_hours,
  recommended_infusion_duration_hours,
  infusion_safety_note,
  calculationDetails,
  frequency_options,
  draftDiffersFromCalculated,
  onApplyRecommendation,
  onSelectFrequency,
}: DoseRecommendationCardProps) {
  if (!recommended_dose || !recommended_interval_hours) {
    return null;
  }

  const doseMatch = recommended_dose.match(/^([\d.]+)\s*(.*)$/);
  const doseValue = doseMatch?.[1] ?? recommended_dose;
  const doseUnit = doseMatch?.[2] || "mg";

  const subline = `Infuse over ${recommended_infusion_duration_hours || "1"} hour${
    (recommended_infusion_duration_hours ?? 1) === 1 ? "" : "s"
  }.`;

  const interpretation = calculationDetails?.review_status?.banner_body || "Calculated optimal regimen based on patient parameters.";

  const options = frequency_options?.filter((o) => o.dose_mg > 0) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        {/* Primary recommendation */}
        <div className="flex items-start justify-between gap-4">
          <div className="tracking-tight">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-4xl font-bold text-slate-950 tabular-nums">{doseValue}</span>
              <span className="text-xl font-semibold text-slate-600">{doseUnit}</span>
              <span className="text-lg font-medium text-slate-500">every</span>
              <span className="text-4xl font-bold text-slate-950 tabular-nums">{recommended_interval_hours}</span>
              <span className="text-xl font-semibold text-slate-600">hours</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{subline}</p>
          </div>
          {draftDiffersFromCalculated && onApplyRecommendation && (
            <button
              type="button"
              onClick={onApplyRecommendation}
              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
            >
              Apply to Inputs
            </button>
          )}
        </div>

        {/* Frequency options */}
        {options.length > 1 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Frequency options</p>
            <div className="grid gap-2">
              {options.map((opt) => {
                const isActive = opt.dose_mg === Number(doseValue) && opt.interval_hours === recommended_interval_hours;
                const range = aucRangeLabel(opt.auc24);
                return (
                  <button
                    key={`${opt.dose_mg}-q${opt.interval_hours}`}
                    type="button"
                    onClick={() => !isActive && onSelectFrequency?.(opt)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? "border-cyan-300 bg-cyan-50 ring-1 ring-cyan-200"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className={`font-bold tabular-nums ${isActive ? "text-cyan-800" : "text-slate-900"}`}>
                        {opt.dose_mg} mg
                      </span>
                      <span className="text-slate-500 font-medium">q{opt.interval_hours}h</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-xs text-slate-500">
                        AUC {opt.auc24}
                      </span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${range.color}`}>
                        {range.label}
                      </span>
                      {isActive && (
                        <span className="inline-flex rounded-full bg-cyan-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {infusion_safety_note && (
           <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
             <strong>Note:</strong> {infusion_safety_note}
           </div>
        )}
      </div>
      <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
        <p>
          <span className="mr-1.5 font-semibold text-slate-800">Interpretation:</span>
          {interpretation}
        </p>
      </div>
    </div>
  );
}
