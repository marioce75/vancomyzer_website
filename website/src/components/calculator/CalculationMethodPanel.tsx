import React from "react";
import Link from "next/link";
import { CalculationDetails, CalculatorMode } from "@/types/calculator";
import { COLIN_2019, modelShortName } from "@/lib/pk/modelRegistry";

interface CalculationMethodPanelProps {
  mode: CalculatorMode;
  levelCount: number;
  details?: CalculationDetails | null;
  assumptions?: string[];
  infusionDurationAdjustedForSafety?: boolean;
  /** Model id from the result's pk_parameters. Omitted before a calculation: Colin 2019, the only dosing model. */
  pkModelName?: string | null;
}

function modeLabel(mode: CalculatorMode, levelCount: number) {
  if (mode === "initial_regimen") return "Empiric Population PK";
  return levelCount >= 2 ? "2 Levels Bayesian posterior" : "1 Level Bayesian posterior";
}

export default function CalculationMethodPanel({
  mode,
  levelCount,
  details,
  assumptions = [],
  infusionDurationAdjustedForSafety = false,
  pkModelName,
}: CalculationMethodPanelProps) {
  return (
    <div>
      <h3 className="vz-kicker m-0 mb-1.5">How this was calculated</h3>
      <dl className="vz-kv mb-2">
        <dt>Method</dt><dd>{details?.method ?? modeLabel(mode, levelCount)}</dd>
        <dt>Model</dt><dd>{modelShortName(pkModelName)} &middot; Adult intermittent IV &middot; two-compartment</dd>
        <dt>Calculation type</dt><dd>{details?.review_status.workflow_fit ?? modeLabel(mode, levelCount)}</dd>
        <dt>Evidence</dt><dd>{details?.evidence_strength ?? "—"}</dd>
        <dt>Safety bounds</dt><dd>{infusionDurationAdjustedForSafety ? "Infusion rate limited to 10 mg/min (duration extended)" : "Standard (10 mg/min max, ≥60 min)"}</dd>
        <dt>Target</dt><dd>AUC₂₄ 400–600 mg·h/L (ASHP/IDSA/PIDS/SIDP 2020)</dd>
      </dl>

      <details className="group" open>
        <summary className="list-none flex cursor-pointer items-center text-xs font-semibold text-blue-700 hover:text-blue-900">
          <svg className="w-4 h-4 mr-1 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Assumptions &amp; references
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-xs text-slate-600">
          <div>
            <strong className="mb-1 block text-slate-800">Assumptions</strong>
            <ul className="list-disc pl-4 space-y-1">
              {assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
              {assumptions.length === 0 && <li>For adults receiving intermittent IV vancomycin only. Steady state assumed unless prior doses specified.</li>}
            </ul>
          </div>
          <div>
            <strong className="mb-1 block text-slate-800">References</strong>
            <ul className="space-y-1.5">
              <li>
                {COLIN_2019.citation}{" "}
                <a href={`https://doi.org/${COLIN_2019.doi}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DOI </a>
              </li>
              <li>
                Rybak MJ et al. <em>Therapeutic monitoring of vancomycin.</em> AJHP. 2020;77(11):835–864.{" "}
                <a href="https://doi.org/10.1093/ajhp/zxaa036" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DOI </a>
              </li>
              <li>
                <Link href="/transparent-dosing" className="text-blue-600 hover:underline font-medium">View full references &amp; equations</Link>
              </li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
