"use client";

import { buildCrClBreakdown } from "@/lib/pk/obesityModel";

interface ObesityAdvisoryPanelProps {
  bmi: number;
  ffm_kg: number;
  sex: "male" | "female";
  /** Optional — when provided, panel renders the age-aware composite advisory
   *  (FDecline factor + multi-method CrCl comparison). */
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  scr_mg_dl?: number;
}

function obesityFDecline(age: number): number {
  if (age <= 0) return 1.0;
  return 1 / (1 + Math.pow(age / 61.6, 2.24));
}

export default function ObesityAdvisoryPanel({
  bmi,
  ffm_kg,
  sex,
  age,
  weight_kg,
  height_cm,
  scr_mg_dl,
}: ObesityAdvisoryPanelProps) {
  const ffmEquation = sex === "male"
    ? "(9270 × TBW) / (6680 + 216 × BMI)"
    : "(9270 × TBW) / (8780 + 244 × BMI)";

  const hasFullInputs = typeof age === "number" && age > 0
    && typeof weight_kg === "number" && weight_kg > 0
    && typeof height_cm === "number" && height_cm > 0
    && typeof scr_mg_dl === "number" && scr_mg_dl > 0;

  const fdecline = hasFullInputs ? obesityFDecline(age!) : null;
  const breakdown = hasFullInputs
    ? buildCrClBreakdown(age!, weight_kg!, height_cm!, scr_mg_dl!, sex)
    : null;
  const isGeriatric = hasFullInputs && age! > 65;

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
      <p className="text-sm font-bold" style={{ color: "#92400e", margin: 0 }}>
        CLASS III OBESITY DETECTED
      </p>
      <div className="mt-2 space-y-1.5 text-xs" style={{ color: "#78350f" }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><strong>BMI:</strong> {bmi.toFixed(1)} kg/m²</span>
          <span><strong>Fat-Free Mass:</strong> {ffm_kg.toFixed(1)} kg <span className="text-[10px]" style={{ color: "#92400e" }}>(Janmahasatian 2005)</span></span>
        </div>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          V1 and V2 calculated using FFM ({ffmEquation}) &mdash; vancomycin is hydrophilic and distributes poorly into adipose tissue.
          CL uses TBW-based CrCl (Cockcroft-Gault) as renal elimination scales with total body weight, then multiplied by an age-decline factor
          (Colin 2019 FDecline) to bridge the obesity-model literature gap on geriatric obese patients.
        </p>

        {fdecline != null && (
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            <strong>Age-decline factor:</strong> {fdecline.toFixed(2)} (CL reduced by {((1 - fdecline) * 100).toFixed(0)}% from the body-scaling estimate at age {Math.round(age!)}).
          </p>
        )}

        {/* Composite advisory: obese + geriatric is the regime where the Smit/Zhang
            cohort had the least representation, so we explicitly call it out and
            show all three CG variants so the clinician can judge. */}
        {isGeriatric && breakdown && (
          <div className="rounded border px-3 py-2 mt-2" style={{ borderColor: "#f59e0b", background: "#fef3c7" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#92400e" }}>
              Geriatric obesity advisory (age &gt; 65, BMI &ge; 40)
            </p>
            <p className="mt-1" style={{ margin: 0, lineHeight: 1.5, color: "#78350f" }}>
              Cockcroft-Gault CrCl interpretation in obese elderly patients is contested. The three common
              weight bases give materially different values for this patient:
            </p>
            <ul className="mt-1 list-disc pl-5" style={{ color: "#78350f", lineHeight: 1.5 }}>
              <li>
                <strong>CG-TBW</strong> ({Math.round(weight_kg!)} kg) &mdash; <strong>{breakdown.cg_tbw_ml_min.toFixed(0)} mL/min</strong> (used by the model)
              </li>
              <li>
                <strong>CG-AdjBW</strong> ({breakdown.adjbw_kg.toFixed(0)} kg = IBW + 0.4&times;(TBW&minus;IBW)) &mdash; <strong>{breakdown.cg_adjbw_ml_min.toFixed(0)} mL/min</strong>
              </li>
              <li>
                <strong>CG-FFM</strong> ({breakdown.ffm_kg.toFixed(0)} kg) &mdash; <strong>{breakdown.cg_ffm_ml_min.toFixed(0)} mL/min</strong> (most conservative)
              </li>
            </ul>
            <p className="mt-1" style={{ margin: 0, lineHeight: 1.5, color: "#78350f" }}>
              Confirm with a measured level before continuing the suggested regimen. If the post-FDecline CL still seems aggressive
              relative to clinical status, manual review is warranted.
            </p>
          </div>
        )}

        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong>Recommendation:</strong> Two-point sampling (peak + trough) per 2020 ASHP/IDSA guidelines for AUC-guided dosing in obesity.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1" style={{ fontSize: 10 }}>
          <a
            href="https://doi.org/10.1111/bcp.14144"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: "#92400e" }}
          >
            Smit 2020 (10.1111/bcp.14144) &nearr;
          </a>
          <a
            href="https://doi.org/10.1007/s40262-023-01324-5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: "#92400e" }}
          >
            Zhang 2023 (10.1007/s40262-023-01324-5) &nearr;
          </a>
          <a
            href="https://doi.org/10.1007/s40262-018-0727-5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: "#92400e" }}
          >
            Colin 2019 (10.1007/s40262-018-0727-5) &nearr;
          </a>
        </div>
      </div>
    </div>
  );
}
