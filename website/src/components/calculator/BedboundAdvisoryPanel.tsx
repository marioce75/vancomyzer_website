"use client";

import React, { useState, useRef, useEffect } from "react"; // useRef kept for todayRef
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
  weightKg,
  onLoadingDoseChange,
}: BedboundAdvisoryPanelProps) {
  const todayRef = useRef(todayYMD());
  const today = todayRef.current;

  const scrLow = scrMgDl != null && scrMgDl > 0 && scrMgDl < 0.7;

  // 15–20 mg/kg for bedbound/geriatric loading dose
  const loadingDoseLow = weightKg ? Math.round(15 * weightKg) : null;
  const loadingDoseHigh = weightKg ? Math.min(Math.round(20 * weightKg), 2000) : null;

  // Infusion end time for level draw recommendation (shown once infusion duration entered)
  const [doseGiven, setDoseGiven] = useState<number>(0);
  const [infusionHours, setInfusionHours] = useState<number>(0);
  const [adminDate, setAdminDate] = useState<string>(today);
  const [adminTime, setAdminTime] = useState<string>("");
  const [adminTimeErr, setAdminTimeErr] = useState<string>("");

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

  // Level draw recommendation: 2–4 h after infusion end
  const levelDrawNote = infusionHours > 0
    ? `Draw level ${infusionHours + 2}–${infusionHours + 4} hours after infusion start (2–4 h post-infusion end).`
    : "Enter infusion duration to see recommended level draw timing.";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🛏</span>
        <p className="text-sm font-semibold text-amber-900">Bedbound/Geriatric — Loading Dose Workflow</p>
      </div>

      {/* SCr warning */}
      {scrLow && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-800">⚠ SCr {scrMgDl} mg/dL — Low Muscle Mass Warning</p>
          <p className="mt-1 text-xs text-red-700 leading-5">
            Low SCr in bedbound patients likely reflects reduced muscle mass, not preserved renal function.
            Consider applying an SCr floor of 0.7–1.0 mg/dL or ordering <strong>cystatin C</strong> before dosing.
          </p>
        </div>
      )}

      {/* Recommended loading dose */}
      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-900">Recommended Loading Dose</p>
        <p className="mt-0.5 text-xs text-amber-800 leading-5">
          <strong>15–20 mg/kg TBW</strong>, maximum <strong>2,000 mg</strong> for geriatric/bedbound patients.
          {loadingDoseLow != null && loadingDoseHigh != null && (
            <> Based on entered weight ({weightKg} kg): <strong>{loadingDoseLow}–{loadingDoseHigh} mg</strong>.</>
          )}
        </p>
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
            <input
              type="number"
              min={0}
              step={250}
              placeholder="e.g. 1000"
              value={doseGiven || ""}
              onChange={(e) => setDoseGiven(e.target.value ? Number(e.target.value) : 0)}
              className={inputCls(false)}
            />
          </div>

          {/* Infusion duration */}
          <div>
            <Label>Infusion duration (h)</Label>
            <input
              type="number"
              min={0}
              step={0.25}
              placeholder="e.g. 1.5"
              value={infusionHours || ""}
              onChange={(e) => setInfusionHours(e.target.value ? Number(e.target.value) : 0)}
              className={inputCls(false)}
            />
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
        <p className="text-xs font-semibold text-blue-900">Recommended Level Draw Timing</p>
        <p className="mt-0.5 text-xs text-blue-800 leading-5">{levelDrawNote}</p>
        <p className="mt-1 text-[11px] text-blue-700">
          After drawing the level, enter it in the <strong>Drug Levels</strong> section. The Bayesian engine will recommend a <strong>maintenance regimen</strong> — not another loading dose.
        </p>
      </div>

      {/* Monitoring reminder */}
      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-900">Monitoring</p>
        <ul className="mt-1 text-xs text-amber-800 leading-5 list-disc pl-4 space-y-0.5">
          <li>Recheck levels every <strong>24 hours</strong> (not standard 48–72h)</li>
          <li><strong>Daily SCr</strong> monitoring — renal function instability is common</li>
        </ul>
      </div>

      {doseGiven > 0 && infusionHours > 0 && adminDate && adminTime && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-800">
            ✓ Dosing History pre-filled: {doseGiven} mg over {infusionHours}h on {adminDate} at {adminTime}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Switch to &quot;1 Level&quot; mode and enter the drawn level below.</p>
        </div>
      )}
    </div>
  );
}
