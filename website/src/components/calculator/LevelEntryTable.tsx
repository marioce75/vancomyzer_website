import React from "react";
import { CalculateRequestLevel } from "@/types/calculator";

interface LevelEntryTableProps {
  levels: CalculateRequestLevel[];
  onChange: (levels: CalculateRequestLevel[]) => void;
  fieldErrors?: Record<string, string>;
}

const emptyLevel: CalculateRequestLevel = {
  value_mcg_ml: 0,
  collection_time: "",
  time_since_last_dose_hours: 0,
};

export default function LevelEntryTable({ levels, onChange, fieldErrors = {} }: LevelEntryTableProps) {
  const update = (index: number, updates: Partial<CalculateRequestLevel>) => {
    const next = [...levels];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const inputClass = (hasError: boolean) =>
    `w-full h-[40px] px-3 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      hasError ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"
    }`;

  const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-700 mb-1">
      {children}
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      {levels.map((level, i) => {
        const timeError = fieldErrors[`levels[${i}].time_since_last_dose_hours`];
        const valueError = fieldErrors[`levels[${i}].value_mcg_ml`];
        return (
          <div key={i} className="flex flex-col gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
            <div>
              <Label>Level {i + 1} (mcg/mL)</Label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={level.value_mcg_ml || ""}
                onChange={(e) => update(i, { value_mcg_ml: e.target.value ? Number(e.target.value) : 0 })}
                className={inputClass(Boolean(valueError))}
                placeholder="0.0"
              />
            </div>
            <div>
              <Label>Time drawn (hrs post-dose)</Label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={level.time_since_last_dose_hours || ""}
                onChange={(e) => update(i, { time_since_last_dose_hours: e.target.value ? Number(e.target.value) : 0 })}
                className={inputClass(Boolean(timeError))}
                placeholder="Hours after start"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
