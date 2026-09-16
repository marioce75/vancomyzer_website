import React, { useState } from "react";
import { CalculateRequestRegimen } from "@/types/calculator";
import { parseClinicalNumber } from "@/lib/parseClinicalNumber";
import ClinicalNumberInput from "./ClinicalNumberInput";

interface RegimenFormProps {
  value: CalculateRequestRegimen;
  onChange: (regimen: CalculateRequestRegimen) => void;
  fieldErrors?: Record<string, string>;
}

const inputClass = (hasError: boolean) =>
  `block w-full h-10 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 transition-colors ${
    hasError
      ? "border-red-500 ring-1 ring-red-500 bg-[rgba(239,68,68,0.06)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      : "border-[var(--navy-border-strong)] bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-[var(--teal)] focus:border-[var(--teal)]"
  }`;

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-sm font-medium text-slate-600 mb-1">
    {children}
  </label>
);

const InputGroup = ({ label, children, error }: { label: string, children: React.ReactNode, error?: string }) => (
  <div>
    <Label>{label}</Label>
    {children}
    {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
  </div>
);

const TARGET_AUC_PRESETS = [400, 450, 500, 550];

export default function RegimenForm({ value, onChange, fieldErrors = {} }: RegimenFormProps) {
  const isPulseDose = value.doses_given === 1;
  const [infusionWarning, setInfusionWarning] = useState("");
  const [parseErrors, setParseErrors] = useState<{ dose?: string; infusion?: string }>({});

  const update = (updates: Partial<CalculateRequestRegimen>) => {
    onChange({ ...value, ...updates });
  };

  const handleDosesGiven = (n: number) => {
    if (n === 1) {
      // Pulse dose: auto-set interval to 12 (placeholder for PK engine) and default target AUC
      update({
        doses_given: 1,
        interval_hours: value.interval_hours > 0 ? value.interval_hours : 12,
        target_auc24: value.target_auc24 ?? 450,
      });
    } else {
      update({ doses_given: n, target_auc24: undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        <InputGroup label="Dose (mg)" error={fieldErrors.dose_mg ?? parseErrors.dose}>
          <ClinicalNumberInput
            inputMode="decimal"
            rejectThousandsGrouping
            placeholder="e.g. 1000"
            value={value.dose_mg}
            onValueChange={(n) => update({ dose_mg: n })}
            onBlurValue={(_v, _raw, parseError) => setParseErrors((prev) => ({ ...prev, dose: parseError ?? undefined }))}
            className={(invalidText) => inputClass(Boolean(fieldErrors.dose_mg || parseErrors.dose || invalidText))}
          />
        </InputGroup>

        {isPulseDose ? (
          /* Pulse dose: Target AUC₂₄ replaces interval selector */
          <InputGroup label="Target AUC₂₄ (mg·h/L)" error={fieldErrors.interval_hours}>
            <div className="flex gap-1">
              {TARGET_AUC_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => update({ target_auc24: preset })}
                  className={`flex-1 h-10 rounded-md border text-sm font-semibold transition ${
                    (value.target_auc24 ?? 450) === preset
                      ? "border-blue-300 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">ASHP/IDSA target range 400–600 mg·h/L. Highlighted option will be closest match.</p>
          </InputGroup>
        ) : (
          <InputGroup label="Interval (hours)" error={fieldErrors.interval_hours}>
            <select
              value={value.interval_hours || ""}
              onChange={(e) => update({ interval_hours: parseClinicalNumber(e.target.value) ?? 0 })}
              className={inputClass(Boolean(fieldErrors.interval_hours))}
            >
              <option value="" disabled>Select...</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={18}>18</option>
              <option value={24}>24</option>
              <option value={36}>36</option>
              <option value={48}>48</option>
              <option value={72}>72</option>
            </select>
          </InputGroup>
        )}

        <InputGroup label="Infusion Duration (hours)" error={fieldErrors.infusion_duration_hours ?? parseErrors.infusion}>
          <ClinicalNumberInput
            inputMode="decimal"
            placeholder="e.g. 1"
            value={value.infusion_duration_hours}
            onValueChange={(n) => update({ infusion_duration_hours: n })}
            onBlurValue={(v, _raw, parseError) => {
              setParseErrors((prev) => ({ ...prev, infusion: parseError ?? undefined }));
              setInfusionWarning(v !== null && v > 4 ? "Infusion duration > 4 hours is unusually long — please verify." : "");
            }}
            className={(invalidText) => inputClass(Boolean(fieldErrors.infusion_duration_hours || parseErrors.infusion || invalidText))}
          />
        </InputGroup>
        {infusionWarning && <p className="text-xs text-amber-700 mt-1">⚠ {infusionWarning}</p>}

        {/* Full-width doses given selector */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Number of doses given before levels drawn
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleDosesGiven(n)}
                className={`flex-1 min-w-[52px] rounded-lg border py-2 text-sm font-semibold transition ${
                  (value.doses_given ?? 0) === n
                    ? "border-blue-300 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleDosesGiven(6)}
              className={`flex-1 min-w-[52px] rounded-lg border py-2 text-sm font-semibold transition ${
                (value.doses_given ?? 0) >= 6
                  ? "border-blue-300 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              6+ (SS)
            </button>
          </div>
          {isPulseDose && (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-800">
                <strong>Pulse / single-dose Bayesian:</strong> One dose given. The Bayesian engine will estimate your patient&apos;s individual CL and V from this level and project a maintenance regimen to hit your AUC₂₄ target. No steady-state assumed.
              </p>
            </div>
          )}
          {(value.doses_given ?? 0) > 1 && (value.doses_given ?? 0) < 5 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                <strong>Non-steady-state:</strong> With only {value.doses_given} doses, vancomycin has not yet reached steady state. Fewer than 5 doses is treated as non-steady state; see limitations in the result.
              </p>
            </div>
          )}
          {(value.doses_given ?? 0) >= 5 && (
            <p className="text-xs text-slate-400 mt-1">≥5 doses — steady-state assumption applied</p>
          )}
        </div>
      </div>
    </div>
  );
}
