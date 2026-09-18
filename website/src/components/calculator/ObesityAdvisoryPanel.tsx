"use client";

import { buildCrClBreakdown, calculateFFM } from "@/lib/pk/obesityModel";
import {
  COLIN_2019,
  COLIN_2021_OBESE_EVALUATION,
  HIGH_BMI_THRESHOLD_KG_M2,
  highBmiAdvisory,
} from "@/lib/pk/modelRegistry";
import { fmt } from "@/lib/formatNumber";

/**
 * High-BMI advisory shown under the patient form when BMI is 40 kg/m² or more.
 *
 * INFORMATION ONLY. Every adult is dosed with the Colin 2019 model at every
 * BMI; nothing in this panel feeds the calculation. The fat-free mass and
 * Cockcroft-Gault comparisons give clinical context only.
 */
interface ObesityAdvisoryPanelProps {
  bmi: number;
  /** Optional. Computed here from weight, height and sex when omitted. */
  ffm_kg?: number;
  /** Needed only for the informational fat-free mass and CrCl comparison. */
  sex?: "male" | "female" | null;
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  scr_mg_dl?: number;
}

const PMID_PATTERN = /PMID:\s*(\d+)/;

export default function ObesityAdvisoryPanel({
  bmi,
  ffm_kg,
  sex = null,
  age,
  weight_kg,
  height_cm,
  scr_mg_dl,
}: ObesityAdvisoryPanelProps) {
  const hasBodySize = typeof weight_kg === "number" && weight_kg > 0
    && typeof height_cm === "number" && height_cm > 0;
  const hasSex = sex === "male" || sex === "female";

  const advisory = hasBodySize
    ? highBmiAdvisory({ weight_kg: weight_kg!, height_cm: height_cm! })
    : null;

  const ffm = hasSex
    ? (ffm_kg && ffm_kg > 0 ? ffm_kg : hasBodySize ? calculateFFM(weight_kg!, height_cm!, sex!) : 0)
    : 0;
  const ffmEquation = sex === "male"
    ? "(9270 × TBW) / (6680 + 216 × BMI)"
    : "(9270 × TBW) / (8780 + 244 × BMI)";

  const hasRenalInputs = hasSex && hasBodySize
    && typeof age === "number" && age > 0
    && typeof scr_mg_dl === "number" && scr_mg_dl > 0;
  const breakdown = hasRenalInputs
    ? buildCrClBreakdown(age!, weight_kg!, height_cm!, scr_mg_dl!, sex!)
    : null;
  const isOlderAdult = typeof age === "number" && age > 65;

  const colin2021Pmid = PMID_PATTERN.exec(COLIN_2021_OBESE_EVALUATION.citation)?.[1];

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
      <p className="text-sm font-bold" style={{ color: "#92400e", margin: 0 }}>
        HIGH BMI ADVISORY (BMI &ge; {HIGH_BMI_THRESHOLD_KG_M2} kg/m²)
      </p>
      <div className="mt-2 space-y-1.5 text-xs" style={{ color: "#78350f" }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          {advisory ??
            `BMI ${fmt(bmi, 1)} kg/m²: estimates use the ${COLIN_2019.shortName} model, the same model used for all adults. Obtain vancomycin levels early to individualize.`}
        </p>

        {hasSex && ffm > 0 ? (
          <div className="rounded border px-3 py-2" style={{ borderColor: "#fcd34d", background: "#ffffff" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#92400e" }}>
              For information only &mdash; these values do not change the calculation
            </p>
            <ul className="mt-1 list-disc pl-5" style={{ color: "#78350f", lineHeight: 1.5 }}>
              <li>
                <strong>Fat-free mass:</strong> {fmt(ffm, 1)} kg{" "}
                <span className="text-[10px]" style={{ color: "#92400e" }}>(Janmahasatian 2005: {ffmEquation})</span>
              </li>
              {breakdown && (
                <>
                  <li>
                    <strong>CrCl, Cockcroft-Gault on total body weight</strong> ({Math.round(weight_kg!)} kg): <strong>{breakdown.cg_tbw_ml_min.toFixed(0)} mL/min</strong>
                  </li>
                  <li>
                    <strong>CrCl on adjusted body weight</strong> ({breakdown.adjbw_kg.toFixed(0)} kg = IBW + 0.4&times;(TBW&minus;IBW)): <strong>{breakdown.cg_adjbw_ml_min.toFixed(0)} mL/min</strong>
                  </li>
                  <li>
                    <strong>CrCl on fat-free mass</strong> ({breakdown.ffm_kg.toFixed(0)} kg): <strong>{breakdown.cg_ffm_ml_min.toFixed(0)} mL/min</strong>
                  </li>
                </>
              )}
            </ul>
            <p className="mt-1" style={{ margin: 0, lineHeight: 1.5, color: "#78350f" }}>
              {COLIN_2019.shortName} uses serum creatinine directly as its renal covariate; it does not use any of these creatinine-clearance estimates.
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Enter sex to see fat-free mass and creatinine-clearance comparisons. They are for information only and do not change the calculation.
          </p>
        )}

        {isOlderAdult && (
          <div className="rounded border px-3 py-2 mt-2" style={{ borderColor: "#f59e0b", background: "#fef3c7" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#92400e" }}>
              Age over 65 with BMI &ge; {HIGH_BMI_THRESHOLD_KG_M2}
            </p>
            <p className="mt-1" style={{ margin: 0, lineHeight: 1.5, color: "#78350f" }}>
              Creatinine-clearance estimates differ widely with the weight used, and serum creatinine may overstate renal
              function when muscle mass is low. Confirm with measured levels before continuing the suggested regimen.
            </p>
          </div>
        )}

        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong>Monitoring:</strong> the 2020 ASHP/IDSA/PIDS/SIDP guideline recommends early monitoring of AUC exposure in
          patients with obesity; a peak and a trough (two levels) support AUC estimation.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1" style={{ fontSize: 10 }}>
          <a
            href={`https://doi.org/${COLIN_2019.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: "#92400e" }}
          >
            {COLIN_2019.shortName} ({COLIN_2019.doi}) ↗
          </a>
          {colin2021Pmid ? (
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${colin2021Pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
              style={{ color: "#92400e" }}
              title={COLIN_2021_OBESE_EVALUATION.summary}
            >
              Colin 2021 evaluation in obese adults (PMID {colin2021Pmid}) ↗
            </a>
          ) : (
            <span title={COLIN_2021_OBESE_EVALUATION.summary}>{COLIN_2021_OBESE_EVALUATION.citation}</span>
          )}
        </div>
      </div>
    </div>
  );
}
