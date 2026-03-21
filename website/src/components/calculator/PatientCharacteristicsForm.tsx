import React from "react";
import { CalculateRequestPatient } from "@/types/calculator";

interface PatientCharacteristicsFormProps {
  value: CalculateRequestPatient;
  onChange: (value: CalculateRequestPatient) => void;
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

const FormRow = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
}: PatientCharacteristicsFormProps) {
  const update = (key: keyof CalculateRequestPatient, val: string | number) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-4">
      <FormRow>
        <InputGroup label="Age (years)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value.age || ""}
            onChange={(e) => update("age", e.target.value ? Number(e.target.value) : 0)}
            className={inputClass(Boolean(fieldErrors["patient.age"]))}
            placeholder="e.g. 65"
          />
        </InputGroup>
        <InputGroup label="Sex">
          <select
            value={value.sex || ""}
            onChange={(e) => update("sex", e.target.value)}
            className={inputClass(Boolean(fieldErrors["patient.sex"]))}
          >
            <option value="" disabled>Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </InputGroup>
      </FormRow>
      <FormRow>
        <InputGroup label="Height (cm)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value.height_cm || ""}
            onChange={(e) => update("height_cm", e.target.value ? Number(e.target.value) : 0)}
            className={inputClass(Boolean(fieldErrors["patient.height_cm"]))}
            placeholder="e.g. 178"
          />
        </InputGroup>
        <InputGroup label="Weight (kg)">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={value.weight_kg || ""}
            onChange={(e) => update("weight_kg", e.target.value ? Number(e.target.value) : 0)}
            className={inputClass(Boolean(fieldErrors["patient.weight_kg"]))}
            placeholder="e.g. 75.5"
          />
        </InputGroup>
      </FormRow>
      <FormRow>
        <InputGroup label="Serum Creatinine (mg/dL)">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={value.serum_creatinine_mg_dl || ""}
            onChange={(e) => update("serum_creatinine_mg_dl", e.target.value ? Number(e.target.value) : 0)}
            className={inputClass(Boolean(fieldErrors["patient.serum_creatinine_mg_dl"]))}
            placeholder="e.g. 1.1"
          />
        </InputGroup>
      </FormRow>
    </div>
  );
}
