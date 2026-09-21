"use client";

import React, { useState, useEffect, useRef } from "react";
import { CalculateRequestLevel } from "@/types/calculator";
import ClinicalNumberInput from "./ClinicalNumberInput";
import DatePartInput from "./DatePartInput";
import { isManualHoursCollectionTime, manualHoursCollectionTime } from "@/lib/manualHoursTimestamp";

interface LevelEntryTableProps {
  levels: CalculateRequestLevel[];
  onChange: (levels: CalculateRequestLevel[]) => void;
  fieldErrors?: Record<string, string>;
  intervalHours?: number;
  prefillDoseDate?: string; // YYYY-MM-DD — pre-fills dose date (from bedbound panel)
  prefillDoseTime?: string; // HH:MM — pre-fills dose time (from bedbound panel)
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parse24hTime(raw: string): { hours: number; minutes: number } | null {
  const cleaned = raw.replace(":", "").trim();
  if (!/^\d{3,4}$/.test(cleaned)) return null;
  const h = cleaned.length === 4 ? parseInt(cleaned.slice(0, 2)) : parseInt(cleaned.slice(0, 1));
  const m = cleaned.length === 4 ? parseInt(cleaned.slice(2)) : parseInt(cleaned.slice(1));
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hours: h, minutes: m };
}

function buildDateTime(date: string, timeFormatted: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeFormatted)) return null;
  const iso = `${date}T${timeFormatted}:00`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}

function calcHours(
  doseDate: string, doseTime: string,
  levelDate: string, levelTime: string,
): number | null {
  const a = buildDateTime(doseDate, doseTime);
  const b = buildDateTime(levelDate, levelTime);
  if (!a || !b) return null;
  const diffMs = b.getTime() - a.getTime();
  if (diffMs < 0) return -1;
  return Math.round((diffMs / 3600000) * 100) / 100;
}

/**
 * Manual-hours mode has no wall-clock times, but the server reads
 * collection_time with Date.parse and compares the gap between two levels'
 * collection times with the difference in their hours after dose. Sending the
 * typed hours ("2.5") as collection_time parsed as a calendar date (Feb 5,
 * 2001) or failed ("7.47"), so valid entries were rejected.
 *
 * Each level therefore gets a synthetic ISO timestamp: this fixed reference
 * dose time plus its hours after dose. The gap between two levels then equals
 * the difference in their entered hours, and time_since_last_dose_hours is sent
 * exactly as entered. The reference date is arbitrary and never shown.
 */
// Defined in @/lib/manualHoursTimestamp so the server-side validator can share
// the same definition without importing this component. Re-exported here
// because existing callers import it from this module.
export { manualHoursCollectionTime };

// ── Shared styles ─────────────────────────────────────────────

const inputClass = (hasError: boolean) =>
  `w-full h-9 px-2.5 border rounded text-sm focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-500 ring-1 ring-red-500 bg-[rgba(239,68,68,0.06)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      : "border-[var(--navy-border-strong)] bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:ring-[var(--teal)] focus:border-[var(--teal)]"
  }`;

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-slate-600 mb-0.5">
    {children}
  </label>
);

// ── Main Component ────────────────────────────────────────────

export default function LevelEntryTable({
  levels,
  onChange,
  fieldErrors = {},
  prefillDoseDate,
  prefillDoseTime,
}: LevelEntryTableProps) {
  const todayRef = useRef(todayYMD());
  const today = todayRef.current;

  // Always-current ref so update() never closes over stale levels prop.
  // This prevents the stale-closure race where a rapid Tab + date event
  // overwrites a just-entered concentration with 0.
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const [dateTimes, setDateTimes] = useState<{
    doseDate: string; doseTime: string;
    levelDate: string; levelTime: string;
    levelTimeErr: string;
    doseTimeErr: string;
  }[]>(levels.map(() => ({
    doseDate: today,
    doseTime: "",
    levelDate: today,
    levelTime: "",
    levelTimeErr: "",
    doseTimeErr: "",
  })));

  // Levels that already carry a synthetic manual-hours timestamp (e.g. after the
  // section panel remounts) reopen in manual-hours mode.
  const [useDateTime, setUseDateTime] = useState<boolean[]>(() =>
    levels.map((l) => !isManualHoursCollectionTime(l.collection_time)),
  );
  const [levelWarnings, setLevelWarnings] = useState<string[]>(levels.map(() => ""));
  const [parseErrors, setParseErrors] = useState<Record<string, string>>({});

  // Restore level date/time from collection_time on mount (handles section panel remounts)
  useEffect(() => {
    let anyRestored = false;
    const restoredDateTimes = dateTimes.map((dt, i) => {
      const level = levels[i];
      if (dt.levelTime) return dt; // already has time — skip
      if (!level?.collection_time) return dt;
      if (isManualHoursCollectionTime(level.collection_time)) return dt; // synthetic, not a real draw time
      const ms = Date.parse(level.collection_time);
      if (isNaN(ms)) return dt;
      const d = new Date(ms);
      const restoredDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const restoredTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (restoredDate === dt.levelDate && restoredTime === dt.levelTime) return dt;
      anyRestored = true;
      return { ...dt, levelDate: restoredDate, levelTime: restoredTime };
    });
    if (anyRestored) setDateTimes(restoredDateTimes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // Sync bedbound prefill: pre-fill dose date/time when loading dose panel provides them
  useEffect(() => {
    if (!prefillDoseDate && !prefillDoseTime) return;
    setDateTimes((prev) =>
      prev.map((dt) => ({
        ...dt,
        ...(prefillDoseDate ? { doseDate: prefillDoseDate } : {}),
        ...(prefillDoseTime ? { doseTime: prefillDoseTime } : {}),
      }))
    );
  }, [prefillDoseDate, prefillDoseTime]);

  const update = (index: number, updates: Partial<CalculateRequestLevel>) => {
    // Use levelsRef.current (not the closure-captured `levels`) to prevent
    // stale reads when rapid events arrive before a re-render commits.
    const next = [...levelsRef.current];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const formatDisplay = (raw: string): string => {
    const cleaned = raw.replace(":", "").replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    return cleaned.slice(0, 2) + ":" + cleaned.slice(2, 4);
  };

  const updateDateTime = (
    index: number,
    field: "doseDate" | "doseTime" | "levelDate" | "levelTime",
    value: string
  ) => {
    const next = [...dateTimes];
    const cur = { ...next[index] };

    if (field === "doseTime" || field === "levelTime") {
      const formatted = formatDisplay(value);
      cur[field] = formatted;
      const valid = parse24hTime(formatted) !== null || formatted === "";
      if (field === "doseTime") cur.doseTimeErr = !valid && formatted.length >= 4 ? "Enter valid 24h time (e.g. 1400)" : "";
      if (field === "levelTime") cur.levelTimeErr = !valid && formatted.length >= 4 ? "Enter valid 24h time (e.g. 0835)" : "";
    } else {
      cur[field] = value; // YYYY-MM-DD from DatePartInput (always complete when called)
    }

    next[index] = cur;
    setDateTimes(next);

    const levelDt = buildDateTime(cur.levelDate, cur.levelTime);
    const collectionTime = levelDt ? levelDt.toISOString() : "";
    const hours = calcHours(cur.doseDate, cur.doseTime, cur.levelDate, cur.levelTime);
    if (hours !== null && hours >= 0) {
      update(index, { time_since_last_dose_hours: hours, collection_time: collectionTime });
    } else if (collectionTime) {
      update(index, { collection_time: collectionTime });
    }
  };

  const toggleMode = (index: number) => {
    const next = [...useDateTime];
    next[index] = !(next[index] ?? true);
    setUseDateTime(next);
    setParseErrors((prev) => ({ ...prev, [`hours-${index}`]: "" }));
    if (!next[index]) {
      update(index, { time_since_last_dose_hours: 0, collection_time: "" });
    } else {
      // Back to date & time: drop the synthetic manual-hours timestamp and use
      // whatever the date and time fields currently give.
      const cur = dateTimes[index];
      const levelDt = cur ? buildDateTime(cur.levelDate, cur.levelTime) : null;
      const hours = cur ? calcHours(cur.doseDate, cur.doseTime, cur.levelDate, cur.levelTime) : null;
      update(index, {
        time_since_last_dose_hours: hours !== null && hours >= 0 ? hours : 0,
        collection_time: levelDt ? levelDt.toISOString() : "",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {levels.map((level, i) => {
        const timeError = fieldErrors[`levels[${i}].time_since_last_dose_hours`];
        const valueError = fieldErrors[`levels[${i}].value_mcg_ml`];
        const collectionError = fieldErrors[`levels[${i}].collection_time`];
        const dt = dateTimes[i] ?? {
          doseDate: today, doseTime: "", levelDate: today, levelTime: "",
          doseTimeErr: "", levelTimeErr: "",
        };
        const hoursComputed = calcHours(dt.doseDate, dt.doseTime, dt.levelDate, dt.levelTime);
        const isDateMode = useDateTime[i] ?? true;
        const crossMidnight =
          dt.levelDate && dt.doseDate &&
          dt.levelDate !== dt.doseDate &&
          /^\d{4}-\d{2}-\d{2}$/.test(dt.levelDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(dt.doseDate);

        return (
          <div key={i} className="rounded-md p-2.5 flex flex-col gap-2.5" style={{border: '1px solid var(--color-border)', background: 'var(--color-highlight, #f7fafc)'}}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Level {i + 1}</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => toggleMode(i)}
                className="text-[11px] font-semibold underline"
                style={{ color: "var(--color-primary)" }}
              >
                {isDateMode ? "Enter hours manually instead" : "Use date & time instead"}
              </button>
            </div>

            {/* 1. Vancomycin level concentration */}
            <div>
              <Label>Vancomycin level concentration (mcg/mL)</Label>
              <div className="flex">
                <ClinicalNumberInput
                  inputMode="decimal"
                  value={level.value_mcg_ml}
                  onValueChange={(concentration) => {
                    update(i, { value_mcg_ml: concentration });
                    setLevelWarnings((prev) => { const n = [...prev]; n[i] = ""; return n; });
                  }}
                  onBlurValue={(v, _raw, parseError) => {
                    setParseErrors((prev) => ({ ...prev, [`value-${i}`]: parseError ?? "" }));
                    setLevelWarnings((prev) => {
                      const n = [...prev];
                      n[i] = v !== null && v > 40 ? `Level ${v} mcg/mL is unusually high — please confirm this value is correct.` : "";
                      return n;
                    });
                  }}
                  className={(invalidText) => `${inputClass(Boolean(valueError || invalidText))} rounded-r-none`}
                  placeholder="e.g. 18.5"
                />
                <span className="flex items-center px-2.5 text-xs rounded-r h-9 shrink-0" style={{background: '#edf2f7', border: '1px solid #a0aec0', borderLeft: 'none', color: '#4a5568'}}>
                  mcg/mL
                </span>
              </div>
              {/* Validation errors only shown after a failed Calculate attempt (set via fieldErrors prop) */}
              {valueError && <p className="text-xs text-red-600 mt-1">{valueError}</p>}
              {!valueError && parseErrors[`value-${i}`] && (
                <p className="text-xs text-red-600 mt-1">{parseErrors[`value-${i}`]}</p>
              )}
              {!valueError && !parseErrors[`value-${i}`] && levelWarnings[i] && (
                <p className="text-xs text-amber-700 mt-1 font-medium">⚠ {levelWarnings[i]}</p>
              )}
            </div>

            {isDateMode ? (
              <>
                {/* 2. Level drawn — date + time */}
                <div>
                  <Label>Level drawn</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <DatePartInput
                        value={dt.levelDate}
                        onChange={(v) => updateDateTime(i, "levelDate", v)}
                        hasError={Boolean(timeError || collectionError)}
                      />
                      <p className="text-[10px] mt-0.5 text-slate-500">Date (MM / DD / YYYY)</p>
                    </div>
                    <div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={dt.levelTime}
                          onChange={(e) => updateDateTime(i, "levelTime", e.target.value)}
                          className={`${inputClass(Boolean(dt.levelTimeErr || timeError || collectionError))} flex-1`}
                          placeholder="e.g. 1435"
                          maxLength={5}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => updateDateTime(i, "levelTime", nowHHMM())}
                          className="shrink-0 h-9 px-2.5 rounded border text-xs font-semibold transition-colors"
                          style={{border: '1px solid #a0aec0', background: '#fff', color: '#1f5e96'}}
                          title="Stamp current time"
                        >
                          Now
                        </button>
                      </div>
                      <p className="text-[10px] mt-0.5 text-slate-500">Military time (HH:MM)</p>
                      {dt.levelTimeErr && <p className="text-[10px] text-red-600">{dt.levelTimeErr}</p>}
                    </div>
                  </div>
                  <p className="text-[11px] mt-1 text-slate-500">Exact date and time blood was drawn</p>
                </div>

                {/* Cross-midnight banner */}
                {crossMidnight && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-start gap-2">
                    <span className="text-amber-700 shrink-0">⚠</span>
                    <p className="text-xs font-semibold text-amber-800">
                      Level drawn on a different date than dose — please verify this is correct before calculating.
                    </p>
                  </div>
                )}

                {/* 3. Last dose administered — date + time */}
                <div>
                  <Label>Last dose administered</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <DatePartInput
                        value={dt.doseDate}
                        onChange={(v) => updateDateTime(i, "doseDate", v)}
                        hasError={false}
                      />
                      <p className="text-[10px] mt-0.5 text-slate-500">Date (MM / DD / YYYY)</p>
                    </div>
                    <div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={dt.doseTime}
                          onChange={(e) => updateDateTime(i, "doseTime", e.target.value)}
                          className={`${inputClass(Boolean(dt.doseTimeErr))} flex-1`}
                          placeholder="e.g. 0800"
                          maxLength={5}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => updateDateTime(i, "doseTime", nowHHMM())}
                          className="shrink-0 h-9 px-2.5 rounded border text-xs font-semibold transition-colors"
                          style={{border: '1px solid #a0aec0', background: '#fff', color: '#1f5e96'}}
                          title="Stamp current time"
                        >
                          Now
                        </button>
                      </div>
                      <p className="text-[10px] mt-0.5 text-slate-500">Military time (HH:MM)</p>
                      {dt.doseTimeErr && <p className="text-[10px] text-red-600">{dt.doseTimeErr}</p>}
                    </div>
                  </div>
                  <p className="text-[11px] mt-1 text-slate-500">Start of the <strong>most recent</strong> infusion before this level was drawn</p>
                </div>

                {/* Live hours post-dose preview */}
                {hoursComputed !== null && hoursComputed >= 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 flex items-center gap-2">
                    <span className="text-blue-600">⏱</span>
                    <div>
                      <p className="text-xs font-semibold text-blue-800">
                        Calculated: <strong>{hoursComputed} hours</strong> post-dose
                      </p>
                      <p className="text-[11px] text-blue-600">Used automatically for PK calculations</p>
                    </div>
                  </div>
                )}
                {hoursComputed === -1 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs font-semibold text-red-800">⚠ Level time is before dose time — please check entries</p>
                  </div>
                )}
                {(timeError || collectionError) && (
                  <p className="text-xs text-red-600">{collectionError || timeError}</p>
                )}
              </>
            ) : (
              <div>
                <Label>Time drawn (hours after dose start)</Label>
                <div className="flex">
                  <ClinicalNumberInput
                    inputMode="decimal"
                    value={level.time_since_last_dose_hours}
                    onValueChange={(hours) => update(i, {
                      time_since_last_dose_hours: hours,
                      collection_time: manualHoursCollectionTime(hours),
                    })}
                    onBlurValue={(_v, _raw, parseError) => {
                      setParseErrors((prev) => ({ ...prev, [`hours-${i}`]: parseError ?? "" }));
                    }}
                    className={(invalidText) => `${inputClass(Boolean(timeError || collectionError || invalidText))} rounded-r-none`}
                    placeholder="e.g. 2.5"
                  />
                  <span className="flex items-center px-2.5 text-xs rounded-r h-9 shrink-0" style={{background: '#edf2f7', border: '1px solid #a0aec0', borderLeft: 'none', color: '#4a5568'}}>
                    hours
                  </span>
                </div>
                {(timeError || collectionError) && <p className="text-xs text-red-600 mt-1">{collectionError || timeError}</p>}
                {!timeError && !collectionError && parseErrors[`hours-${i}`] && (
                  <p className="text-xs text-red-600 mt-1">{parseErrors[`hours-${i}`]}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
