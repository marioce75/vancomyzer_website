"use client";

import type { CalculateRequestPatient } from "@/types/calculator";

interface PatientCharacteristicsFormProps {
  value: CalculateRequestPatient;
  onChange: (patient: CalculateRequestPatient) => void;
}

export default function PatientCharacteristicsForm({
  value,
  onChange,
}: PatientCharacteristicsFormProps) {
  const update = (key: keyof CalculateRequestPatient, val: string | number) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Patient characteristics
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Age</span>
          <input
            type="number"
            min={0}
            value={value.age || ""}
            onChange={(e) => update("age", e.target.value ? Number(e.target.value) : 0)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Sex</span>
          <select
            value={value.sex || ""}
            onChange={(e) => update("sex", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">
            Height (cm)
          </span>
          <input
            type="number"
            min={0}
            value={value.height_cm || ""}
            onChange={(e) =>
              update("height_cm", e.target.value ? Number(e.target.value) : 0)
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">
            Weight (kg)
          </span>
          <input
            type="number"
            min={0}
            value={value.weight_kg || ""}
            onChange={(e) =>
              update("weight_kg", e.target.value ? Number(e.target.value) : 0)
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-gray-700">
            Serum creatinine (mg/dL)
          </span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={value.serum_creatinine_mg_dl ?? ""}
            onChange={(e) =>
              update(
                "serum_creatinine_mg_dl",
                e.target.value ? Number(e.target.value) : 0
              )
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>
    </section>
  );
}
