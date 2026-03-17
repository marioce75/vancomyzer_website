"use client";

import type { CalculateRequestRegimen } from "@/types/calculator";

interface RegimenFormProps {
  value: CalculateRequestRegimen;
  onChange: (regimen: CalculateRequestRegimen) => void;
}

export default function RegimenForm({ value, onChange }: RegimenFormProps) {
  const update = (key: keyof CalculateRequestRegimen, val: number) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Current vancomycin regimen
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">
            Dose (mg)
          </span>
          <input
            type="number"
            min={0}
            value={value.dose_mg ?? ""}
            onChange={(e) =>
              update("dose_mg", e.target.value ? Number(e.target.value) : 0)
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">
            Interval (hours)
          </span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={value.interval_hours ?? ""}
            onChange={(e) =>
              update(
                "interval_hours",
                e.target.value ? Number(e.target.value) : 0
              )
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">
            Infusion duration (hours)
          </span>
          <input
            type="number"
            min={0}
            step={0.25}
            value={value.infusion_duration_hours ?? ""}
            onChange={(e) =>
              update(
                "infusion_duration_hours",
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
