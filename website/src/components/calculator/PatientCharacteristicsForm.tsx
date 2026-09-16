import React, { useState } from "react";
import { CalculateRequestPatient } from "@/types/calculator";
import { COLIN_2019, computeBmi, HIGH_BMI_THRESHOLD_KG_M2, highBmiAdvisory } from "@/lib/pk/modelRegistry";
import BedboundAdvisoryPanel, { BedboundDoseData } from "./BedboundAdvisoryPanel";
import ClinicalNumberInput from "./ClinicalNumberInput";
import ObesityAdvisoryPanel from "./ObesityAdvisoryPanel";

/** BMI outside this range almost always means weight or height was entered in the wrong units. */
const PLAUSIBLE_BMI_MIN = 12;
const PLAUSIBLE_BMI_MAX = 80;

interface PatientCharacteristicsFormProps {
  value: CalculateRequestPatient;
  onChange: (value: CalculateRequestPatient) => void;
  fieldErrors?: Record<string, string>;
  onRrtChange?: (rrt: boolean) => void;
  rrt?: boolean | null;
  bedbound: boolean;
  onBedboundChange: (val: boolean) => void;
  onBedboundLoadingDoseChange?: (data: BedboundDoseData | null) => void;
}

const inputClass = (hasError: boolean) =>
  `block w-full h-10 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 transition-colors ${
    hasError
      ? "border-red-500 ring-1 ring-red-500 bg-[rgba(239,68,68,0.06)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      : "border-[var(--navy-border-strong)] bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-[var(--teal)] focus:border-[var(--teal)]"
  }`;

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-600 mb-1">
    {children}
  </label>
);

const FormRow = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
    {children}
  </div>
);

const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div>
    <Label>{label}</Label>
    {children}
  </div>
);

export default function PatientCharacteristicsForm({
  value,
  onChange,
  fieldErrors = {},
  onRrtChange,
  rrt = null,
  bedbound,
  onBedboundChange,
  onBedboundLoadingDoseChange,
}: PatientCharacteristicsFormProps) {
  const [blurErrors, setBlurErrors] = useState<Record<string, string>>({});
  const [blurWarnings, setBlurWarnings] = useState<Record<string, string>>({});

  const update = (key: keyof CalculateRequestPatient, val: string | number) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-4">
      <FormRow>
        <InputGroup label="Age (years)">
          <ClinicalNumberInput
            inputMode="numeric"
            value={value.age}
            onValueChange={(n) => update("age", n)}
            onBlurValue={(v, _raw, parseError) => {
              const err = v === null ? (parseError ?? "")
                        : v > 0 && v < 18 ? "Age must be ≥ 18 years"
                        : v > 110 ? "Age > 110 — please verify"
                        : "";
              setBlurErrors((prev) => ({ ...prev, age: err }));
            }}
            className={(invalidText) => inputClass(Boolean(fieldErrors["patient.age"] || blurErrors.age || invalidText))}
            placeholder="e.g. 65"
          />
          {(blurErrors.age) && <p className="mt-1 text-xs text-red-600">{blurErrors.age}</p>}
        </InputGroup>
        <InputGroup label="Weight (kg)">
          <ClinicalNumberInput
            inputMode="decimal"
            value={value.weight_kg}
            onValueChange={(n) => update("weight_kg", n)}
            onBlurValue={(v, _raw, parseError) => {
              const err = v === null ? (parseError ?? "")
                        : v > 0 && v < 30 ? "Weight must be ≥ 30 kg"
                        : v > 300 ? "Weight > 300 kg — please verify"
                        : "";
              setBlurErrors((prev) => ({ ...prev, weight: err }));
            }}
            className={(invalidText) => inputClass(Boolean(fieldErrors["patient.weight_kg"] || blurErrors.weight || invalidText))}
            placeholder="e.g. 75.5"
          />
          {blurErrors.weight && <p className="mt-1 text-xs text-red-600">{blurErrors.weight}</p>}
        </InputGroup>
      </FormRow>
      <FormRow>
        <InputGroup label="Serum Creatinine (mg/dL)">
          {/* Parsed with parseClinicalNumber: "1,2" is 1.2, never 1. Unparseable
              text leaves the value empty and marks the field invalid. */}
          <ClinicalNumberInput
            inputMode="decimal"
            rejectThousandsGrouping
            value={value.serum_creatinine_mg_dl}
            onValueChange={(n) => update("serum_creatinine_mg_dl", n)}
            onBlurValue={(parsed, _raw, parseError) => {
              if (parsed === null || parsed < 0) {
                const err = parsed === null ? (parseError ?? "") : "SCr cannot be negative.";
                setBlurErrors((prev) => ({ ...prev, scr: err }));
                setBlurWarnings((prev) => ({ ...prev, scr: "" }));
              } else {
                if (parsed > 15) {
                  setBlurErrors((prev) => ({ ...prev, scr: "SCr > 15 mg/dL — please verify this value. If it was reported in µmol/L, divide by 88.4." }));
                  setBlurWarnings((prev) => ({ ...prev, scr: "" }));
                } else if (parsed < 0.4) {
                  setBlurErrors((prev) => ({ ...prev, scr: "" }));
                  setBlurWarnings((prev) => ({ ...prev, scr: "SCr < 0.4 mg/dL may reflect low muscle mass — verify renal function if bedbound." }));
                } else {
                  setBlurErrors((prev) => ({ ...prev, scr: "" }));
                  setBlurWarnings((prev) => ({ ...prev, scr: "" }));
                }
              }
            }}
            className={(invalidText) => inputClass(Boolean(fieldErrors["patient.serum_creatinine_mg_dl"] || blurErrors.scr || invalidText))}
            placeholder="e.g. 1.1"
          />
          <p className="mt-1 text-[11px] text-slate-500">mg/dL (µmol/L ÷ 88.4)</p>
          {blurErrors.scr && <p className="mt-1 text-xs text-red-600">{blurErrors.scr}</p>}
          {!blurErrors.scr && blurWarnings.scr && <p className="mt-1 text-xs text-amber-700">⚠ {blurWarnings.scr}</p>}
        </InputGroup>
      </FormRow>

      {/* Height + Sex — optional. Neither changes the model: height gives BMI (high-BMI
          advisory and unit check); sex is used only for the informational FFM/CrCl comparison. */}
      <FormRow>
        <InputGroup label="Height (cm)">
          <ClinicalNumberInput
            inputMode="decimal"
            value={value.height_cm}
            onValueChange={(n) => update("height_cm", n)}
            onBlurValue={(_v, _raw, parseError) => {
              setBlurErrors((prev) => ({ ...prev, height: parseError ?? "" }));
            }}
            className={(invalidText) => inputClass(Boolean(fieldErrors["patient.height_cm"] || blurErrors.height || invalidText))}
            placeholder="e.g. 170"
          />
          {blurErrors.height && <p className="mt-1 text-xs text-red-600">{blurErrors.height}</p>}
        </InputGroup>
        <InputGroup label="Sex">
          <select
            value={value.sex || ""}
            onChange={(e) => update("sex", e.target.value)}
            className={inputClass(false)}
          >
            <option value="">— Select —</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </InputGroup>
      </FormRow>

      {/* BMI, unit check and high-BMI advisory. Information only: there is no
          model switch at any BMI (Colin 2019 is used for every adult). */}
      {value.weight_kg > 0 && value.height_cm > 0 && (() => {
        const bmi = computeBmi(value.weight_kg, value.height_cm);
        if (bmi === null || !isFinite(bmi) || bmi <= 0) return null;
        const isHighBmi = bmi >= HIGH_BMI_THRESHOLD_KG_M2;
        const unitsImplausible = bmi > PLAUSIBLE_BMI_MAX || bmi < PLAUSIBLE_BMI_MIN;
        const sex = value.sex === "male" || value.sex === "female" ? value.sex : null;
        return (
          <>
            <div className="flex items-center gap-2 text-xs" style={{ color: isHighBmi ? "#92400e" : "var(--color-secondary)" }}>
              <span style={{ fontWeight: 600 }}>BMI: {bmi.toFixed(1)} kg/m²</span>
            </div>
            {unitsImplausible && (
              <p className="text-xs text-amber-700 font-medium" role="status">⚠ Check units — weight in kg, height in cm</p>
            )}
            {isHighBmi && (
              <ObesityAdvisoryPanel
                bmi={bmi}
                sex={sex}
                age={value.age}
                weight_kg={value.weight_kg}
                height_cm={value.height_cm}
                scr_mg_dl={value.serum_creatinine_mg_dl}
              />
            )}
          </>
        );
      })()}
      {value.weight_kg > 0 && !(value.height_cm > 0) && (() => {
        // No height: BMI cannot be assessed. The registry flags this for heavier patients.
        const advisory = highBmiAdvisory({ weight_kg: value.weight_kg, height_cm: null });
        return advisory ? <p className="text-xs text-amber-700">⚠ {advisory}</p> : null;
      })()}

      {/* Renal Replacement Therapy guard */}
      <div className={`rounded-xl border px-4 py-3 ${rrt === null ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
        <p className="text-sm font-medium text-slate-700 mb-1">
          Renal Replacement Therapy (RRT)?
          <span className="ml-1.5 text-xs font-normal text-amber-600">{rrt === null ? "— required" : ""}</span>
        </p>
        <p className="text-xs text-slate-500 mb-2">CRRT, hemodialysis, peritoneal dialysis</p>
        <div className="flex gap-2">
          {([false, true] as const).map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onRrtChange?.(val)}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition ${
                rrt === val
                  ? val
                    ? "border-red-300 bg-red-600 text-white shadow-sm"
                    : "border-emerald-300 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
              }`}
            >
              {val ? "Yes" : "No"}
            </button>
          ))}
        </div>
        {rrt === null && (
          <p className="mt-2 text-xs text-amber-700">Please select before the calculator can run.</p>
        )}
        {rrt === true && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-semibold text-red-800">⚠ Calculator blocked</p>
            <p className="mt-0.5 text-xs text-red-700 leading-5">
              The {COLIN_2019.shortName} model is not validated for patients on renal replacement therapy (CRRT, HD, PD). Use a specialist RRT-specific dosing protocol or consult pharmacy.
            </p>
          </div>
        )}
      </div>

      {/* Bedbound/Geriatric toggle */}
      <div>
        <button
          type="button"
          onClick={() => onBedboundChange(!bedbound)}
          className={`w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            bedbound
              ? "border-amber-300 bg-amber-100 text-amber-900"
              : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="12" width="18" height="3" fill="var(--color-primary)"/>
              <rect x="1" y="5" width="2" height="10" fill="var(--color-primary)"/>
              <rect x="17" y="9" width="2" height="6" fill="var(--color-primary)"/>
              <line x1="3" y1="9" x2="17" y2="9" stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="2 1"/>
              <rect x="3" y="9" width="14" height="3" fill="var(--color-primary)" fillOpacity="0.3"/>
              <rect x="4" y="6" width="4" height="3" rx="1" fill="var(--color-primary)"/>
              <ellipse cx="12" cy="7.5" rx="2.5" ry="2" fill="none" stroke="var(--color-primary)" strokeWidth="1"/>
              <rect x="2" y="15" width="1.5" height="3" fill="var(--color-primary)"/>
              <rect x="16.5" y="15" width="1.5" height="3" fill="var(--color-primary)"/>
            </svg> Bedbound/Geriatric Patient
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bedbound ? "bg-amber-300 text-amber-900" : "bg-slate-100 text-slate-400"}`}>
            {bedbound ? "ON" : "OFF"}
          </span>
        </button>
        {bedbound && (
          <div className="mt-2">
            <BedboundAdvisoryPanel
              scrMgDl={value.serum_creatinine_mg_dl}
              weightKg={value.weight_kg}
              onLoadingDoseChange={onBedboundLoadingDoseChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
