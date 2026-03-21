import React from "react";
import { CalculationDetails, CalculatorMode } from "@/types/calculator";

interface CalculationMethodPanelProps {
  mode: CalculatorMode;
  levelCount: number;
  details?: CalculationDetails | null;
  assumptions?: string[];
  infusionDurationAdjustedForSafety?: boolean;
}

function modeLabel(mode: CalculatorMode, levelCount: number) {
  if (mode === "initial_regimen") return "Empiric Population PK";
  return levelCount >= 2 ? "2-Level Bayesian Posterior" : "1-Level Bayesian Posterior";
}

export default function CalculationMethodPanel({
  mode,
  levelCount,
  details,
  assumptions = [],
  infusionDurationAdjustedForSafety = false,
}: CalculationMethodPanelProps) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
      <h3 className="m-0 mb-3 text-base font-semibold text-slate-900">How this was calculated</h3>
      
      <div className="mb-3 grid gap-2 text-sm text-slate-700">
        <div className="flex justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="font-medium text-slate-500">Method</span>
          <span>{details?.method ?? modeLabel(mode, levelCount)}</span>
        </div>
        <div className="flex justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="font-medium text-slate-500">Model</span>
          <span>Adult Intermittent IV</span>
        </div>
        <div className="flex justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="font-medium text-slate-500">Safety Bounds</span>
          <span>{infusionDurationAdjustedForSafety ? "Infusion rate maxed" : "Standard"}</span>
        </div>
      </div>

      <details className="group">
        <summary className="list-none flex cursor-pointer items-center text-sm font-medium text-cyan-700 hover:text-cyan-900">
          <svg className="w-4 h-4 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          More details
        </summary>
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <div>
            <strong className="mb-1 block text-slate-800">Formulas</strong>
            <p>Target AUC24: 400–600 mg·h/L. Logic path: {details?.review_status.workflow_fit ?? modeLabel(mode, levelCount)}</p>
          </div>
          <div>
            <strong className="mb-1 block text-slate-800">Assumptions</strong>
            <ul className="list-disc pl-4 space-y-1">
              {assumptions.slice(0, 3).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
              {assumptions.length === 0 && <li>Adult intermittent IV workflow only. Steady state assumed unless prior doses specified.</li>}
            </ul>
          </div>
          <div>
            <strong className="mb-1 block text-slate-800">References</strong>
            <p>2020 ASHP/IDSA/PIDS guidelines; FDA infusion-rate precautions.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
