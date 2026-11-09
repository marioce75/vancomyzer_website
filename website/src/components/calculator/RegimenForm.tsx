
import { LocalizedText } from "@/localization/LanguageProvider";

import { LocalizedInput, LocalizedDiv } from "@/localization/LocalizedElements";
import React, { useState } from "react";
import { CalculateRequestRegimen } from "@/types/calculator";
import { parseClinicalNumber } from "@/lib/parseClinicalNumber";
import ClinicalNumberInput from "./ClinicalNumberInput";
import {
  EXACT_COUNT_MIN,
  loadingDoseGiven,
  maintenanceCountMissing,
  maintenanceDosesGiven,
  onlyLoadingDoseGiven,
  setExactMaintenanceCount,
  setLoadingDoseGiven,
  setMaintenanceDosesGiven,
  summarizeDosingHistory,
  updateLoadingDose,
} from "./dosingHistory";

interface RegimenFormProps {
  value: CalculateRequestRegimen;
  onChange: (regimen: CalculateRequestRegimen) => void;
  fieldErrors?: Record<string, string>;
}

const inputClass = (hasError: boolean) =>
  `block w-full h-9 px-2.5 border rounded-md text-sm focus:outline-none focus:ring-1 transition-colors ${
    hasError
      ? "border-red-500 ring-1 ring-red-500 bg-[rgba(239,68,68,0.06)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      : "border-[var(--navy-border-strong)] bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-[var(--teal)] focus:border-[var(--teal)]"
  }`;

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-slate-600 mb-0.5">
    {children}
  </label>
);

const InputGroup = ({ label, children, error }: { label: string, children: React.ReactNode, error?: string }) => (
  <div>
    <Label><LocalizedText text={label} /></Label>
    {children}
    {error && <span className="block mt-1 text-xs text-red-600"><LocalizedText text={error} /></span>}
  </div>
);

const TARGET_AUC_PRESETS = [400, 450, 500, 550];

const segClass = (on: boolean) =>
  `flex-1 min-w-[40px] rounded-md border py-1.5 text-xs font-semibold transition ${
    on
      ? "border-blue-300 bg-blue-600 text-white shadow-sm"
      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
  }`;

/**
 * Dosing history, in the order the doses were given:
 *   1. Loading dose given? (always asked; its own fields)
 *   2. Maintenance dose
 *   3. Maintenance doses given before the level (the loading dose is not counted)
 *   4. A plain-language summary of what was entered
 * The request payload is unchanged; see dosingHistory.ts for the mapping.
 */
export default function RegimenForm({ value, onChange, fieldErrors = {} }: RegimenFormProps) {
  const [infusionWarning, setInfusionWarning] = useState("");
  const [parseErrors, setParseErrors] = useState<{ dose?: string; infusion?: string }>({});
  const hasLoading = loadingDoseGiven(value);
  const loadOnly = onlyLoadingDoseGiven(value);
  const maintenanceCount = maintenanceDosesGiven(value);
  // "6 or more": the exact count is typed. While the field is blank or holds a
  // partial entry the count is missing (NaN), the history is kept as entered
  // and Calculate is refused (CalculatorWorkspace); the field stays visible.
  const countMissing = maintenanceCountMissing(value);
  const exactCount = (maintenanceCount ?? 0) >= EXACT_COUNT_MIN || countMissing;
  const isPulseDose = value.doses_given === 1;
  const summary = summarizeDosingHistory(value);
  const fe = (key: string) => fieldErrors[`regimen.${key}`] ?? fieldErrors[key];

  const update = (updates: Partial<CalculateRequestRegimen>) => {
    onChange({ ...value, ...updates });
  };

  const countButtons = hasLoading ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];

  const targetAucPicker = (
    <InputGroup label="Target AUC₂₄ (mg·h/L)" error={fieldErrors.interval_hours}>
      <div className="flex gap-1">
        {TARGET_AUC_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => update({ target_auc24: preset })}
            className={`flex-1 h-9 rounded-md border text-sm font-semibold transition ${
              (value.target_auc24 ?? 450) === preset
                ? "border-blue-300 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-1"><LocalizedText text="ASHP/IDSA target range 400–600 mg·h/L. Highlighted option will be closest match." /></p>
    </InputGroup>
  );

  return (
    <div className="space-y-2.5">
      {/* 1. Loading dose — always asked, never hidden behind the dose count */}
      <fieldset className="rounded-md border border-slate-200 px-2.5 py-2">
        <legend className="px-1 text-xs font-semibold text-slate-700"><LocalizedText text="Loading dose given?" /></legend>
        <LocalizedDiv className="flex gap-1.5" role="radiogroup" aria-label="Loading dose given?">
          {[
            { on: false, label: "No" },
            { on: true, label: "Yes" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={hasLoading === opt.on}
              onClick={() => onChange(setLoadingDoseGiven(value, opt.on))}
              className={segClass(hasLoading === opt.on)}
            >
              <LocalizedText text={opt.label} />
            </button>
          ))}
        </LocalizedDiv>
        {hasLoading && (
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <InputGroup label="Loading dose given (mg)" error={fe("loading_dose_mg") ?? (loadOnly ? fieldErrors.dose_mg : undefined)}>
              <ClinicalNumberInput
                inputMode="decimal"
                placeholder="e.g. 2000"
                value={value.loading_dose_mg ?? 0}
                onValueChange={(n) => onChange(updateLoadingDose(value, { loading_dose_mg: n }))}
                className={(invalidText) => inputClass(Boolean(fe("loading_dose_mg") || invalidText))}
              />
            </InputGroup>
            <InputGroup label="Loading infusion (minutes)" error={fe("loading_infusion_duration_hours") ?? (loadOnly ? fieldErrors.infusion_duration_hours : undefined)}>
              <ClinicalNumberInput
                inputMode="decimal"
                placeholder="e.g. 200"
                value={Number(((value.loading_infusion_duration_hours ?? 0) * 60).toFixed(6))}
                onValueChange={(n) => onChange(updateLoadingDose(value, { loading_infusion_duration_hours: n / 60 }))}
                className={(invalidText) => inputClass(Boolean(fe("loading_infusion_duration_hours") || invalidText))}
              />
            </InputGroup>
            {!loadOnly && (maintenanceCount !== undefined || countMissing) && (
              <div className="col-span-2">
                <InputGroup label="Hours from start of loading dose to first maintenance dose" error={fe("loading_to_maintenance_hours")}>
                  <ClinicalNumberInput
                    inputMode="decimal"
                    placeholder={value.interval_hours ? `${value.interval_hours} (the interval)` : "e.g. 12"}
                    value={value.loading_to_maintenance_hours ?? 0}
                    onValueChange={(n) => update({ loading_to_maintenance_hours: !Number.isFinite(n) ? NaN : n > 0 ? n : undefined })}
                    className={(invalidText) => inputClass(Boolean(fe("loading_to_maintenance_hours") || invalidText))}
                  />
                </InputGroup>
              </div>
            )}
          </div>
        )}
      </fieldset>

      {/* 2. Maintenance doses given before the level (the loading dose is not counted) */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1"><LocalizedText text="Maintenance doses given before the level" /></label>
        <div className="flex flex-wrap gap-1.5">
          {countButtons.map((n) => (
            <button key={n} type="button" onClick={() => onChange(setMaintenanceDosesGiven(value, n))} className={segClass(maintenanceCount === n)}>
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(setMaintenanceDosesGiven(value, EXACT_COUNT_MIN))}
            className={segClass(exactCount)}
          ><LocalizedText text="6 or more" /></button>
        </div>
        {hasLoading && <p className="mt-1 text-[10px] text-slate-500"><LocalizedText text="Do not count the loading dose here. Choose 0 if the level was drawn after the loading dose alone." /></p>}
        {exactCount && (
          <label className="mt-2 block text-xs text-slate-600"><LocalizedText text="Exact number of maintenance doses given" /><ClinicalNumberInput aria-label="Exact number of maintenance doses given" inputMode="numeric" min={EXACT_COUNT_MIN} max={1000} step={1}
              className={inputClass(Boolean(fe("doses_given")) || countMissing)}
              value={maintenanceCount !== undefined && maintenanceCount >= EXACT_COUNT_MIN ? maintenanceCount : NaN}
              emptyError="Enter the exact number of maintenance doses given (6 or more). The doses entered below are kept until you do."
              onValueChange={(n) => onChange(setExactMaintenanceCount(value, n))} />
          </label>
        )}
        {fe("doses_given") && !countMissing && <p className="mt-1 text-xs text-red-600"><LocalizedText text={fe("doses_given")} /></p>}
      </div>

      {/* 3. Maintenance dose (hidden while the loading dose is the only dose given) */}
      {loadOnly ? (
        <div className="grid grid-cols-1 gap-y-2">{targetAucPicker}</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <InputGroup label={hasLoading ? "Maintenance dose (mg)" : "Dose (mg)"} error={fieldErrors.dose_mg ?? parseErrors.dose}>
            <ClinicalNumberInput
              inputMode="decimal"
              placeholder="e.g. 1000"
              value={value.dose_mg}
              onValueChange={(n) => update({ dose_mg: n })}
              onBlurValue={(_v, _raw, parseError) => setParseErrors((prev) => ({ ...prev, dose: parseError ?? undefined }))}
              className={(invalidText) => inputClass(Boolean(fieldErrors.dose_mg || parseErrors.dose || invalidText))}
            />
          </InputGroup>

          {isPulseDose ? (
            /* Single dose: Target AUC₂₄ replaces interval selector */
            targetAucPicker
          ) : (
            <InputGroup label="Interval (hours)" error={fieldErrors.interval_hours}>
              <select
                value={value.interval_hours || ""}
                onChange={(e) => update({ interval_hours: parseClinicalNumber(e.target.value) ?? 0 })}
                className={inputClass(Boolean(fieldErrors.interval_hours))}
              >
                <option value="" disabled><LocalizedText text="Select..." /></option>
                <option value={6}>6</option>
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

          <InputGroup label="Infusion Duration (minutes)" error={fieldErrors.infusion_duration_hours ?? parseErrors.infusion}>
            <ClinicalNumberInput
              inputMode="decimal"
              placeholder="e.g. 100"
              value={Number((value.infusion_duration_hours * 60).toFixed(6))}
              onValueChange={(n) => update({ infusion_duration_hours: n / 60 })}
              onBlurValue={(v, _raw, parseError) => {
                setParseErrors((prev) => ({ ...prev, infusion: parseError ?? undefined }));
                setInfusionWarning(v !== null && v > 240 ? "Infusion duration > 240 minutes is unusually long — please verify." : "");
              }}
              className={(invalidText) => inputClass(Boolean(fieldErrors.infusion_duration_hours || parseErrors.infusion || invalidText))}
            />
          </InputGroup>
          {infusionWarning && <p className="text-xs text-amber-700 mt-1">⚠ <LocalizedText text={infusionWarning} /></p>}
        </div>
      )}

      <div>
        {isPulseDose && (
          <div className="mt-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5">
            <p className="text-xs text-blue-800">
              <strong><LocalizedText text="Pulse / single-dose Bayesian:" /></strong>{" "}<LocalizedText text="One dose given. The calculator will use Bayesian estimation to estimate your patient's individual CL and V from this level and project a maintenance regimen to hit your AUC₂₄ target. No steady-state assumed." /></p>
          </div>
        )}
        {!hasLoading && (value.doses_given ?? 0) > 1 && (value.doses_given ?? 0) < 5 && (
          <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
            <p className="text-xs text-amber-800">
              <strong><LocalizedText text="Actual history:" /></strong>{" "}<LocalizedText text="with" />{" "}{value.doses_given}{" "}<LocalizedText text="doses the level is fitted by superposing exactly" />{" "}{value.doses_given}{" "}<LocalizedText text="doses; exposure at dose" />{" "}{value.doses_given}{" "}<LocalizedText text="is reported separately from the steady-state projection." /></p>
          </div>
        )}
        {hasLoading && !loadOnly && (
          <p className="mt-1.5 text-xs text-slate-500"><LocalizedText text="The level is fitted to the actual doses (loading dose, then the maintenance doses), so a loading dose is not mistaken for slow clearance. Steady-state confirmation is not used when a loading dose is entered." /></p>
        )}
        {!hasLoading && (value.doses_given ?? 0) > 1 && (
          <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={value.steady_state_confirmed === true}
              onChange={(e) => update({ steady_state_confirmed: e.target.checked })} />
            <span><LocalizedText text="I have verified consistent dosing and sufficient time to reach steady state. Dose count alone does not establish steady state." /></span>
          </label>
        )}

        {/* 4. Plain-language reading of what was entered */}
        {summary && (
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5" role="status" aria-live="polite">
            <p className="text-xs text-slate-700"><strong><LocalizedText text="History entered:" /></strong>{" "}<LocalizedText text={summary} /></p>
            <p className="mt-0.5 text-[10px] text-slate-500"><LocalizedText text="Enter each level's time from the start of the last dose given." /></p>
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500"><LocalizedText text="Without confirmation, the exact dose count is used. Levels must follow the last dose given. A loading dose as dose 1 is supported; changed, held or missed maintenance doses are not." /></p>
      </div>
    </div>
  );
}
