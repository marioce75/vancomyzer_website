import React from "react";
import { CalculateRequestRegimen } from "@/types/calculator";

interface RegimenFormProps {
  value: CalculateRequestRegimen;
  onChange: (regimen: CalculateRequestRegimen) => void;
  fieldErrors?: Record<string, string>;
}

const inputClass = (hasError: boolean) =>
  `block w-full h-10 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
    hasError ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
  }`;

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-600 mb-1">
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

export default function RegimenForm({ value, onChange, fieldErrors = {} }: RegimenFormProps) {
  const update = (key: keyof CalculateRequestRegimen, val: number) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        <InputGroup label="Dose (mg)" error={fieldErrors.dose_mg}>
          <input
            type="number"
            min={0}
            step={250}
            placeholder="e.g. 1000"
            value={value.dose_mg || ""}
            onChange={(e) => update("dose_mg", e.target.value ? Number(e.target.value) : 0)}
            className={inputClass(Boolean(fieldErrors.dose_mg))}
          />
        </InputGroup>

        <InputGroup label="Interval (hours)" error={fieldErrors.interval_hours}>
          <select
            value={value.interval_hours || ""}
            onChange={(e) => update("interval_hours", Number(e.target.value))}
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

        <InputGroup label="Infusion Duration (hours)" error={fieldErrors.infusion_duration_hours}>
          <input
            type="number"
            min={0}
            step={0.25}
            placeholder="e.g. 1"
            value={value.infusion_duration_hours || ""}
            onChange={(e) => update("infusion_duration_hours", e.target.value ? Number(e.target.value) : 0)}
            className={inputClass(Boolean(fieldErrors.infusion_duration_hours))}
          />
        </InputGroup>
      </div>
    </div>
  );
}
