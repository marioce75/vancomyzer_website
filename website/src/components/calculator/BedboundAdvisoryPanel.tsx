"use client";

import React, { useState, useRef, useEffect } from "react"; // useRef kept for todayRef
import ClinicalNumberInput from "./ClinicalNumberInput";
import DatePartInput from "./DatePartInput";

export interface BedboundDoseData {
  dose_mg: number;
  infusion_duration_hours: number;
  adminDate: string; // YYYY-MM-DD
  adminTime: string; // HH:MM
}

interface BedboundAdvisoryPanelProps {
  scrMgDl?: number;
  weightKg?: number;
  onLoadingDoseChange?: (data: BedboundDoseData | null) => void;
}


function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTimeDisplay(raw: string): string {
  const cleaned = raw.replace(":", "").replace(/\D/g, "");
  if (cleaned.length <= 2) return cleaned;
  return cleaned.slice(0, 2) + ":" + cleaned.slice(2, 4);
}

const inputCls = (hasError: boolean) =>
  `w-full h-[40px] px-3 border rounded text-sm focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-500 ring-1 ring-red-500 bg-[rgba(239,68,68,0.06)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      : "border-[var(--navy-border-strong)] bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-[var(--teal)] focus:border-[var(--teal)]"
  }`;

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
    {children}
  </label>
);

export default function BedboundAdvisoryPanel({
  scrMgDl,
  onLoadingDoseChange,
}: BedboundAdvisoryPanelProps) {
  const todayRef = useRef(todayYMD());
  const today = todayRef.current;

  const scrLow = scrMgDl != null && scrMgDl > 0 && scrMgDl < 0.7;


  // Infusion end time for level draw recommendation (shown once infusion duration entered)
  const [doseGiven, setDoseGiven] = useState<number>(0);
  const [infusionHours, setInfusionHours] = useState<number>(0);
  const [adminDate, setAdminDate] = useState<string>(today);
  const [adminTime, setAdminTime] = useState<string>("");
  const [adminTimeErr, setAdminTimeErr] = useState<string>("");
  const [parseErrors, setParseErrors] = useState<{ dose?: string; infusion?: string }>({});

  // Fire callback whenever form values change
  useEffect(() => {
    if (doseGiven > 0 && infusionHours > 0) {
      onLoadingDoseChange?.({
        dose_mg: doseGiven,
        infusion_duration_hours: infusionHours,
        adminDate,
        adminTime,
      });
    } else {
      onLoadingDoseChange?.(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doseGiven, infusionHours, adminDate, adminTime]);

  const handleAdminTimeChange = (raw: string) => {
    const formatted = formatTimeDisplay(raw);
    setAdminTime(formatted);
    const valid = /^\d{2}:\d{2}$/.test(formatted)
      ? (() => { const h = parseInt(formatted); const m = parseInt(formatted.slice(3)); return h <= 23 && m <= 59; })()
      : formatted === "";
    setAdminTimeErr(!valid && formatted.length >= 4 ? "Enter valid 24h time (e.g. 1400)" : "");
  };

  // Report entered infusion duration without prescribing a universal sampling time.
  const levelDrawNote = infusionHours > 0
    ? `Entered infusion duration: ${infusionHours} hours. Record the actual collection time and use the sampling plan selected by your clinical team.`
    : "Enter the actual infusion duration and collection time. Sampling depends on the monitoring method and clinical circumstances.";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🛏</span>
        <p className="text-sm font-semibold text-amber-900">Bedbound or frail patient — dosing and monitoring review</p>
      </div>

      {/* SCr warning */}
      {scrLow && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-800">⚠ SCr {scrMgDl} mg/dL — Low Muscle Mass Warning</p>
          <p className="mt-1 text-xs text-red-700 leading-5">
            Low SCr in bedbound patients may reflect reduced muscle mass rather than preserved renal function, so
            the estimate may overstate clearance. Routinely rounding SCr up to a fixed value is not recommended: rounding
            to 1 mg/dL reduced dose-prediction accuracy in a retrospective study of older adults (Bukhari 2024). Plan early
            therapeutic drug monitoring to help individualize dosing. Cystatin C or a measured creatinine clearance can inform your
            clinical assessment but cannot be entered into the Colin 2019 model.
          </p>
        </div>
      )}

      {/* Frailty alone does not establish a loading dose or dose cap. */}
      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-900">Individualize the loading dose</p>
        <p className="mt-0.5 text-xs text-amber-800 leading-5">
          Bedbound status or frailty alone does not establish a specific loading dose or a 2,000 mg maximum.
          Review infection severity, actual body weight, fluid status, renal trajectory, prior doses and your institutional protocol.
          Select maintenance dosing separately, with early therapeutic drug monitoring when indicated.
        </p>
        <details className="mt-2 text-xs text-amber-800">
          <summary className="cursor-pointer font-semibold">What the guideline supports</summary>
          <p className="mt-2 leading-5">
            For intermittent IV therapy in critically ill adults with suspected or documented serious MRSA infection,
            the 2020 consensus guideline allows consideration of 20–35 mg/kg actual body weight, maximum 3,000 mg.
            In adults with obesity and serious infection, it allows consideration of 20–25 mg/kg actual body weight,
            maximum 3,000 mg. These are conditional recommendations, not a default dose for every frail patient.
          </p>
          <p className="mt-2 leading-5">
            For Bayesian AUC assessment, the guideline prefers two concentrations, typically 1–2 hours after infusion
            and at the end of the dosing interval. A single early post-load level is not a universally validated
            sampling strategy for bedbound patients. Follow the selected method and local protocol.
          </p>
          <a className="mt-2 inline-block underline" href="https://academic.oup.com/jpids/article/9/3/281/5871024" target="_blank" rel="noopener noreferrer">
            Read the 2020 ASHP/IDSA/PIDS/SIDP consensus guideline
          </a>
          <p className="mt-2 leading-5">
            The small 2022 bedridden-patient study evaluated AUC prediction, not loading doses, and used a different model.
            It does not validate a bedbound dose rule or Vancomyzer.
          </p>
          <a className="mt-2 inline-block underline" href="https://www.jstage.jst.go.jp/article/bpb/45/6/45_b22-00070/_html/-char/en" target="_blank" rel="noopener noreferrer">
            Read Sonoda et al., 2022
          </a>
        </details>
      </div>

      {/* Loading dose entry form */}
      <div className="rounded-lg border border-amber-200 bg-white px-3 py-3 space-y-3">
        <p className="text-xs font-semibold text-amber-900">Loading Dose Administered</p>
        <p className="text-[11px] text-amber-700">
          Enter details below. Dosing History will be pre-filled automatically — do not re-enter.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Dose given */}
          <div>
            <Label>Dose given (mg)</Label>
            <ClinicalNumberInput
              inputMode="decimal"
              rejectThousandsGrouping
              placeholder="e.g. 1000"
              value={doseGiven}
              onValueChange={setDoseGiven}
              onBlurValue={(_v, _raw, parseError) => setParseErrors((prev) => ({ ...prev, dose: parseError ?? undefined }))}
              className={(invalidText) => inputCls(invalidText)}
            />
            {parseErrors.dose && <p className="mt-1 text-[11px] text-red-600">{parseErrors.dose}</p>}
          </div>

          {/* Infusion duration */}
          <div>
            <Label>Infusion duration (h)</Label>
            <ClinicalNumberInput
              inputMode="decimal"
              placeholder="e.g. 1.5"
              value={infusionHours}
              onValueChange={setInfusionHours}
              onBlurValue={(_v, _raw, parseError) => setParseErrors((prev) => ({ ...prev, infusion: parseError ?? undefined }))}
              className={(invalidText) => inputCls(invalidText)}
            />
            {parseErrors.infusion && <p className="mt-1 text-[11px] text-red-600">{parseErrors.infusion}</p>}
          </div>
        </div>

        {/* Admin date */}
        <div>
          <Label>Date administered</Label>
          <DatePartInput
            value={adminDate}
            onChange={setAdminDate}
          />
          <p className="text-[10px] text-slate-400 mt-0.5">MM / DD / YYYY</p>
        </div>

        {/* Admin time */}
        <div>
          <Label>Time administered (military)</Label>
          <div className="flex gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={adminTime}
              onChange={(e) => handleAdminTimeChange(e.target.value)}
              className={`${inputCls(Boolean(adminTimeErr))} flex-1`}
              placeholder="e.g. 0800"
              maxLength={5}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => handleAdminTimeChange(nowHHMM())}
              className="shrink-0 h-[40px] px-2.5 rounded border text-xs font-semibold transition-colors"
              style={{border: '1px solid var(--navy-border-strong)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)'}}
              title="Stamp current time"
            >
              Now
            </button>
          </div>
          {adminTimeErr && <p className="text-[10px] text-red-600 mt-0.5">{adminTimeErr}</p>}
        </div>
      </div>

      {/* Recommended level draw timing */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
        <p className="text-xs font-semibold text-blue-900">Level collection and timing</p>
        <p className="mt-0.5 text-xs text-blue-800 leading-5">{levelDrawNote}</p>
        <p className="mt-1 text-[11px] text-blue-700">
          Enter measured concentrations and actual collection times in <strong>Drug Levels</strong>. Review whether the available history and levels support a maintenance estimate before using the result.
        </p>
      </div>

      {/* Monitoring reminder */}
      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-900">Monitoring</p>
        <ul className="mt-1 text-xs text-amber-800 leading-5 list-disc pl-4 space-y-0.5">
          <li>Individualize repeat levels to renal stability, exposure, clinical status and your institutional protocol.</li>
          <li>Frequent or daily monitoring may be appropriate when renal function or hemodynamics are unstable; bedbound status alone does not set the schedule.</li>
        </ul>
      </div>

      {doseGiven > 0 && infusionHours > 0 && adminDate && adminTime && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-800">
            Dosing History pre-filled: {doseGiven} mg over {infusionHours}h on {adminDate} at {adminTime}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Enter the measured level and its actual collection time below. A second appropriately timed level may be needed.</p>
        </div>
      )}
    </div>
  );
}
